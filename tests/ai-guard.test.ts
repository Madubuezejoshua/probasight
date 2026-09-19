import { describe, expect, it } from "vitest";
import { hasAnalysableQuestion } from "@/lib/ai/market-context";
import type { PantaMarket } from "@/lib/panta/types";

/**
 * Regression coverage for an observed hallucination.
 *
 * A live market with an empty title AND empty description, category "sports"
 * and world-politics oracle feeds caused the model to invent an entire
 * question ("Will Marco Rubio win the 2028 Republican nomination?"). Nothing in
 * the data referenced Rubio, 2028, or a nomination.
 *
 * The guard below is what stops that: analysis is refused outright when the
 * market does not state what it asks.
 */
function market(overrides: Partial<PantaMarket>): PantaMarket {
  return {
    marketId: "AESrMoZxcTGQibC1rNEmq3oz9qoDqHhomUe6MQEw1k9F",
    category: "sports",
    title: "",
    description: "",
    phase: "primary",
    ...overrides,
  } as PantaMarket;
}

describe("hasAnalysableQuestion", () => {
  it("refuses a market with no title and no description", () => {
    expect(hasAnalysableQuestion(market({}))).toBe(false);
  });

  it("refuses when both fields are only whitespace", () => {
    expect(hasAnalysableQuestion(market({ title: "   ", description: "\n" }))).toBe(false);
  });

  it("refuses even when rich but non-identifying metadata is present", () => {
    // Exactly the shape that produced the hallucination: oracle feed names are
    // a DATA SOURCE, not the question, and must not make a market analysable.
    expect(
      hasAnalysableQuestion(
        market({
          oracle: "world-politics-reuters,world-politics-ap,global-reuters,global-ap",
          region: "Global",
          category: "sports",
        }),
      ),
    ).toBe(false);
  });

  it("allows a market with a real title", () => {
    expect(hasAnalysableQuestion(market({ title: "Will BTC close above 150k?" }))).toBe(true);
  });

  it("allows a market whose question lives in description (the live shape)", () => {
    expect(
      hasAnalysableQuestion(
        market({ title: "", description: "Will Cisco report FY2026 AI revenue above $X?" }),
      ),
    ).toBe(true);
  });

  it("handles null and undefined fields", () => {
    expect(hasAnalysableQuestion(market({ title: undefined, description: null }))).toBe(false);
  });
});
