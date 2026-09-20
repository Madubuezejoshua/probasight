import { describe, expect, it } from "vitest";
import {
  formatDateShort,
  formatRelative,
  formatTimeUntil,
  isPast,
  datetimeLocalToUnix,
  secondsUntilIso,
  unixToDate,
  unixToDatetimeLocal,
} from "@/lib/utils/time";
import { UNAVAILABLE } from "@/lib/utils/format";

/**
 * Regression coverage for a live-API mismatch.
 *
 * Panta's docs describe startTime/endTime/resolutionTime as integer Unix
 * seconds, but the production catalog returns ISO-8601 strings. Treating only
 * one form as valid made every date on the market page render as "-".
 */
describe("unixToDate, both Panta wire formats", () => {
  it("parses documented integer Unix seconds", () => {
    const date = unixToDate(1767225600);
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("parses the ISO-8601 strings the live catalog actually returns", () => {
    const date = unixToDate("2026-01-01T00:00:00Z");
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("treats both forms of the same instant as equal", () => {
    const fromUnix = unixToDate(1767225600);
    const fromIso = unixToDate("2026-01-01T00:00:00Z");
    expect(fromUnix!.getTime()).toBe(fromIso!.getTime());
  });

  it("parses a numeric string as Unix seconds, not as a date literal", () => {
    const date = unixToDate("1767225600");
    expect(date!.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns null for missing or unparseable values rather than epoch 1970", () => {
    expect(unixToDate(null)).toBeNull();
    expect(unixToDate(undefined)).toBeNull();
    expect(unixToDate("")).toBeNull();
    expect(unixToDate(0)).toBeNull();
    expect(unixToDate(-1)).toBeNull();
    expect(unixToDate("not a date")).toBeNull();
    expect(unixToDate(Number.NaN)).toBeNull();
  });
});

describe("formatters accept both wire formats", () => {
  const unix = 1767225600;
  const iso = "2026-01-01T00:00:00Z";

  it("formatDateShort agrees across formats", () => {
    expect(formatDateShort(unix)).toBe(formatDateShort(iso));
    expect(formatDateShort(unix)).not.toBe(UNAVAILABLE);
  });

  it("formatTimeUntil agrees across formats", () => {
    const now = Date.UTC(2025, 11, 1);
    expect(formatTimeUntil(unix, now)).toBe(formatTimeUntil(iso, now));
  });

  it("formatRelative agrees across formats", () => {
    const now = Date.UTC(2026, 0, 2);
    expect(formatRelative(unix, now)).toBe(formatRelative(iso, now));
  });

  it("every formatter degrades to the unavailable marker, never a fake date", () => {
    expect(formatDateShort(null)).toBe(UNAVAILABLE);
    expect(formatTimeUntil(null)).toBe(UNAVAILABLE);
    expect(formatRelative(null)).toBe(UNAVAILABLE);
  });
});

describe("formatTimeUntil", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("reports a closed market once the end time has passed", () => {
    expect(formatTimeUntil(Date.UTC(2026, 0, 1, 11, 0, 0) / 1000, now)).toBe("Closed");
  });

  it("counts down in sensible units", () => {
    expect(formatTimeUntil(Date.UTC(2026, 0, 1, 12, 30, 0) / 1000, now)).toBe("30m left");
    expect(formatTimeUntil(Date.UTC(2026, 0, 1, 17, 0, 0) / 1000, now)).toBe("5h left");
    expect(formatTimeUntil(Date.UTC(2026, 0, 4, 12, 0, 0) / 1000, now)).toBe("3d left");
  });
});

describe("isPast", () => {
  const now = Date.UTC(2026, 0, 1);
  it("works on both formats and is false for unknown values", () => {
    expect(isPast("2025-01-01T00:00:00Z", now)).toBe(true);
    expect(isPast("2027-01-01T00:00:00Z", now)).toBe(false);
    expect(isPast(null, now)).toBe(false);
  });
});

describe("create-form time helpers stay numeric", () => {
  // Market CREATION sends integer Unix seconds, which is what Panta accepts.
  it("round-trips a datetime-local value through Unix seconds", () => {
    const unix = datetimeLocalToUnix("2026-06-01T12:30");
    expect(typeof unix).toBe("number");
    expect(unixToDatetimeLocal(unix!)).toBe("2026-06-01T12:30");
  });

  it("rejects an empty or malformed local value", () => {
    expect(datetimeLocalToUnix("")).toBeNull();
    expect(datetimeLocalToUnix("nonsense")).toBeNull();
  });
});

describe("secondsUntilIso, quote and session expiry countdowns", () => {
  it("computes remaining seconds from an ISO expiry", () => {
    const now = Date.parse("2026-09-04T16:26:00.000Z");
    expect(secondsUntilIso("2026-09-04T16:27:00.000Z", now)).toBe(60);
  });

  it("goes negative once expired, so callers can invalidate", () => {
    const now = Date.parse("2026-09-04T16:28:00.000Z");
    expect(secondsUntilIso("2026-09-04T16:27:00.000Z", now)).toBe(-60);
  });

  it("returns null for a missing or invalid expiry", () => {
    expect(secondsUntilIso(null)).toBeNull();
    expect(secondsUntilIso("nope")).toBeNull();
  });
});
