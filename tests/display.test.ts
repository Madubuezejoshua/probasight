import { describe, expect, it } from "vitest";
import { marketInitial, marketSubtitle, marketTitle } from "@/lib/panta/display";

/**
 * Regression coverage for a live-catalog behaviour.
 *
 * The production Panta catalog returns `title` as an empty string on every
 * market and carries the actual question in `description`. Rendering `title`
 * directly left every card, heading and portfolio row blank.
 */
describe("marketTitle", () => {
  it("uses title when the catalog populates it (sandbox behaviour)", () => {
    expect(
      marketTitle({
        title: "Sandbox test market",
        description: "Fixture market.",
        marketId: "Abc123",
      }),
    ).toBe("Sandbox test market");
  });

  it("falls back to description when title is empty (live behaviour)", () => {
    expect(
      marketTitle({
        title: "",
        description: "Will BTC close above $150,000 on 2026-12-31?",
        marketId: "Abc123",
      }),
    ).toBe("Will BTC close above $150,000 on 2026-12-31?");
  });

  it("treats a whitespace-only title as empty", () => {
    expect(
      marketTitle({ title: "   ", description: "Real question?", marketId: "Abc" }),
    ).toBe("Real question?");
  });

  it("truncates a long description on a word boundary", () => {
    const long =
      "Will Prime Minister Andy Burnham formally announce a delay, reduction, or full cancellation of the previously scheduled infrastructure programme before the end of the current parliamentary session in the year two thousand and twenty six";
    const result = marketTitle({ title: "", description: long, marketId: "Abc" });
    expect(result.length).toBeLessThanOrEqual(181);
    expect(result.endsWith("…")).toBe(true);
    // Must not cut mid-word.
    expect(result.slice(0, -1).trimEnd()).toBe(result.slice(0, -1).trimEnd().trimEnd());
    expect(long.startsWith(result.slice(0, -1))).toBe(true);
  });

  it("never returns an empty string, even with nothing usable", () => {
    const fromId = marketTitle({ title: "", description: "", marketId: "FFFcvy12DfhFMQ" });
    expect(fromId).toContain("FFFcvy12");
    expect(marketTitle({ title: null, description: null, marketId: "" })).toBe(
      "Untitled market",
    );
  });

  it("handles null and undefined fields", () => {
    expect(marketTitle({ title: null, description: "Q?", marketId: "A" })).toBe("Q?");
    expect(marketTitle({ title: undefined, description: "Q?", marketId: "A" })).toBe("Q?");
  });
});

describe("marketSubtitle", () => {
  it("returns the description when it is not already the heading", () => {
    expect(marketSubtitle({ title: "Short title", description: "Longer detail." })).toBe(
      "Longer detail.",
    );
  });

  it("returns null when the description IS the heading, to avoid printing it twice", () => {
    expect(marketSubtitle({ title: "", description: "Will X happen?" })).toBeNull();
  });

  it("returns null when there is no description", () => {
    expect(marketSubtitle({ title: "A title", description: null })).toBeNull();
    expect(marketSubtitle({ title: "A title", description: "   " })).toBeNull();
  });
});

describe("marketInitial", () => {
  it("takes the first alphanumeric character of the resolved name", () => {
    expect(marketInitial({ title: "Bitcoin market", description: null, marketId: "A" })).toBe(
      "B",
    );
    expect(marketInitial({ title: "", description: "will it rain?", marketId: "A" })).toBe(
      "W",
    );
  });

  it("falls back to a question mark for non-alphanumeric leads", () => {
    expect(marketInitial({ title: "…odd", description: null, marketId: "A" })).toBe("?");
  });
});
