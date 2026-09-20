import { describe, expect, it } from "vitest";
import { readFlow } from "@/components/home/HeroIntelligenceCard";
import type { PantaCatalogTrade } from "@/lib/panta/types";

/**
 * Share-flow reducer behind the homepage hero card's signal strip.
 *
 * The arithmetic matters because the card states a YES/NO split as fact about a
 * real market. Getting the base units wrong would misreport live trading, so
 * the values below are taken from an actual Panta tape observed during the
 * build: four primary trades on one market, in 1e6 base units.
 */

function trade(overrides: Partial<PantaCatalogTrade>): PantaCatalogTrade {
  return { marketId: "m", isPrimary: true, ...overrides };
}

/** The real tape, newest first, exactly as Panta returned it. */
const LIVE_TAPE: PantaCatalogTrade[] = [
  trade({ yesAmount: 0, noAmount: 26381903, blockTime: 1789821959 }),
  trade({ yesAmount: 26382384, noAmount: 0, blockTime: 1789821959 }),
  trade({ yesAmount: 0, noAmount: 163553806, blockTime: 1789821957 }),
  trade({ yesAmount: 163647964, noAmount: 0, blockTime: 1789821956 }),
];

describe("readFlow", () => {
  it("converts 1e6 base units to whole shares", () => {
    const flow = readFlow(LIVE_TAPE);

    // 163647964 + 26382384 = 190030348 base units.
    expect(flow.yesShares).toBeCloseTo(190.030348, 6);
    // 163553806 + 26381903 = 189935709 base units.
    expect(flow.noShares).toBeCloseTo(189.935709, 6);
  });

  it("produces a split consistent with the market's own pricing", () => {
    const flow = readFlow(LIVE_TAPE);
    const total = flow.yesShares + flow.noShares;
    const yesPercent = (flow.yesShares / total) * 100;

    // That market's live yesPrice was 0.500078865, so the flow must round to
    // the same 50/50 the card displays next to it.
    expect(Math.round(yesPercent)).toBe(50);
  });

  it("reverses the tape so bars read oldest to newest", () => {
    const flow = readFlow(LIVE_TAPE);

    // Panta returns newest first; the oldest trade is the largest YES buy.
    expect(flow.bars[0]).toEqual({ shares: 163.647964, side: "yes" });
    expect(flow.bars.at(-1)).toEqual({ shares: 26.381903, side: "no" });
  });

  it("assigns one side per row and never double counts", () => {
    const flow = readFlow(LIVE_TAPE);

    expect(flow.bars).toHaveLength(4);
    expect(flow.bars.filter((b) => b.side === "yes")).toHaveLength(2);
    expect(flow.bars.filter((b) => b.side === "no")).toHaveLength(2);
  });

  it("skips rows carrying neither side rather than counting them as zero", () => {
    const flow = readFlow([
      trade({ yesAmount: 0, noAmount: 0 }),
      trade({ yesAmount: null, noAmount: null }),
      trade({ yesAmount: 5000000, noAmount: 0 }),
    ]);

    expect(flow.bars).toHaveLength(1);
    expect(flow.yesShares).toBeCloseTo(5, 6);
    expect(flow.noShares).toBe(0);
  });

  it("returns an empty result for an empty tape, never a fabricated bar", () => {
    const flow = readFlow([]);

    expect(flow).toEqual({ yesShares: 0, noShares: 0, bars: [] });
  });

  it("caps the strip while still counting every trade in the totals", () => {
    const many = Array.from({ length: 40 }, () =>
      trade({ yesAmount: 1_000_000, noAmount: 0 }),
    );

    const flow = readFlow(many);

    // 22 bars are rendered, but all 40 trades contribute to the split.
    expect(flow.bars).toHaveLength(22);
    expect(flow.yesShares).toBeCloseTo(40, 6);
  });
});
