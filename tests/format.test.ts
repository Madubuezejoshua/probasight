import { describe, expect, it } from "vitest";
import {
  UNAVAILABLE,
  estimatePositionValueUsdc,
  formatImpliedPercent,
  formatPrice,
  formatShareBaseUnits,
  formatShares,
  formatUsdcBaseUnits,
  formatUsdcDecimal,
  parseUsdcAmount,
  priceToImpliedPercent,
  shareBaseUnitsToNumber,
  toUsdcAmountString,
  truncateAddress,
} from "@/lib/utils/format";

describe("formatUsdcBaseUnits", () => {
  it("converts Panta 6-decimal base units to human USDC", () => {
    // Panta's own documented example: "50000000" === 50 USDC.
    expect(formatUsdcBaseUnits("50000000")).toBe("50.00 USDC");
    expect(formatUsdcBaseUnits("2500000")).toBe("2.50 USDC");
    expect(formatUsdcBaseUnits(1_000_000)).toBe("1.00 USDC");
  });

  it("omits the symbol when asked", () => {
    expect(formatUsdcBaseUnits("50000000", false)).toBe("50.00");
  });

  it("returns the unavailable marker rather than substituting zero", () => {
    expect(formatUsdcBaseUnits(null)).toBe(UNAVAILABLE);
    expect(formatUsdcBaseUnits(undefined)).toBe(UNAVAILABLE);
    expect(formatUsdcBaseUnits("")).toBe(UNAVAILABLE);
    expect(formatUsdcBaseUnits("not-a-number")).toBe(UNAVAILABLE);
  });
});

describe("formatShareBaseUnits", () => {
  it("treats catalog trade amounts as 1e6 base units", () => {
    expect(formatShareBaseUnits("10000000")).toBe("10");
    expect(formatShareBaseUnits("1500000")).toBe("1.5");
  });

  it("keeps a genuine zero distinct from missing data", () => {
    expect(formatShareBaseUnits(0)).toBe("0");
    expect(formatShareBaseUnits(null)).toBe(UNAVAILABLE);
  });

  it("exposes the numeric conversion for chart maths", () => {
    expect(shareBaseUnitsToNumber("2500000")).toBe(2.5);
    expect(shareBaseUnitsToNumber(null)).toBeNull();
  });
});

describe("formatUsdcDecimal", () => {
  it("formats already-decimal volume strings", () => {
    expect(formatUsdcDecimal("1200.00")).toBe("1,200.00 USDC");
    expect(formatUsdcDecimal("8.6")).toBe("8.60 USDC");
  });

  it("does not invent a volume when the field is absent", () => {
    expect(formatUsdcDecimal(null)).toBe(UNAVAILABLE);
  });
});

describe("price helpers", () => {
  it("formats spot prices to three decimals", () => {
    expect(formatPrice("0.485866425")).toBe("0.486");
    expect(formatPrice(0.52)).toBe("0.520");
    expect(formatPrice(null)).toBe(UNAVAILABLE);
  });

  it("reads a 0-1 share price as an implied percentage", () => {
    expect(priceToImpliedPercent("0.62")).toBeCloseTo(62);
    expect(formatImpliedPercent("0.62")).toBe("62%");
    expect(formatImpliedPercent("0.485")).toBe("49%");
  });

  it("refuses to imply a percentage from an out-of-range price", () => {
    // A price outside 0-1 is not a probability; showing one would be a lie.
    expect(priceToImpliedPercent("1.4")).toBeNull();
    expect(priceToImpliedPercent("-0.2")).toBeNull();
    expect(formatImpliedPercent("1.4")).toBe(UNAVAILABLE);
    expect(formatImpliedPercent(null)).toBe(UNAVAILABLE);
  });
});

describe("formatShares", () => {
  it("formats the human-readable share strings from /positions/", () => {
    expect(formatShares("38.40")).toBe("38.4");
    expect(formatShares("1234.5678")).toBe("1,234.5678");
    expect(formatShares(null)).toBe(UNAVAILABLE);
  });
});

describe("truncateAddress", () => {
  it("truncates long base58 addresses", () => {
    const address = "Buyer111111111111111111111111111111111";
    expect(truncateAddress(address)).toBe("Buye…1111");
    expect(truncateAddress(address, 6)).toBe("Buyer1…111111");
  });

  it("leaves short values intact and handles absence", () => {
    expect(truncateAddress("abc")).toBe("abc");
    expect(truncateAddress(null)).toBe(UNAVAILABLE);
  });
});

describe("parseUsdcAmount", () => {
  it("accepts positive decimal input", () => {
    expect(parseUsdcAmount("20")).toBe(20);
    expect(parseUsdcAmount("20.50")).toBe(20.5);
    expect(parseUsdcAmount("  5  ")).toBe(5);
  });

  it("rejects zero, negatives and non-numeric input", () => {
    expect(parseUsdcAmount("0")).toBeNull();
    expect(parseUsdcAmount("-5")).toBeNull();
    expect(parseUsdcAmount("abc")).toBeNull();
    expect(parseUsdcAmount("")).toBeNull();
    expect(parseUsdcAmount("1e5")).toBeNull();
  });

  it("normalises to the decimal string Panta expects", () => {
    expect(toUsdcAmountString(20)).toBe("20.00");
    expect(toUsdcAmountString(5.5)).toBe("5.50");
  });
});

describe("estimatePositionValueUsdc", () => {
  it("marks an open position to the matching side price", () => {
    // Panta's documented example: 38.40 shares x 0.52 = 19.968
    expect(
      estimatePositionValueUsdc({
        shares: "38.40",
        side: "yes",
        phase: "primary",
        outcome: null,
        yesPrice: "0.52",
        noPrice: "0.48",
      }),
    ).toBeCloseTo(19.968);

    expect(
      estimatePositionValueUsdc({
        shares: "100",
        side: "no",
        phase: "primary",
        outcome: null,
        yesPrice: "0.52",
        noPrice: "0.48",
      }),
    ).toBeCloseTo(48);
  });

  it("settles a resolved winner at 1 USDC per share and a loser at zero", () => {
    expect(
      estimatePositionValueUsdc({
        shares: "38",
        side: "yes",
        phase: "resolved",
        outcome: "yes",
        yesPrice: "0.9",
        noPrice: "0.1",
      }),
    ).toBe(38);

    expect(
      estimatePositionValueUsdc({
        shares: "38",
        side: "no",
        phase: "resolved",
        outcome: "yes",
        yesPrice: "0.9",
        noPrice: "0.1",
      }),
    ).toBe(0);
  });

  it("ignores stale spot prices once the market has resolved", () => {
    // Settlement is 1/0, so a lingering spot price must not drive the value.
    const value = estimatePositionValueUsdc({
      shares: "10",
      side: "yes",
      phase: "resolved",
      outcome: "yes",
      yesPrice: "0.5",
      noPrice: "0.5",
    });
    expect(value).toBe(10);
  });

  it("returns null when no honest reference exists", () => {
    expect(
      estimatePositionValueUsdc({
        shares: "38.40",
        side: "yes",
        phase: "primary",
        outcome: null,
        yesPrice: null,
        noPrice: null,
      }),
    ).toBeNull();

    expect(
      estimatePositionValueUsdc({
        shares: null,
        side: "yes",
        phase: "primary",
        yesPrice: "0.5",
        noPrice: "0.5",
      }),
    ).toBeNull();

    // Cancelled markets have no defined settlement value.
    expect(
      estimatePositionValueUsdc({
        shares: "10",
        side: "yes",
        phase: "cancelled",
        outcome: null,
        yesPrice: "0.5",
        noPrice: "0.5",
      }),
    ).toBeNull();
  });
});
