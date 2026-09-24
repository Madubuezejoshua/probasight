import { describe, expect, it, vi } from "vitest";
import {
  MAX_HERO_ATTEMPTS,
  buildHeroCandidates,
  selectHeroMarket,
  shuffle,
} from "@/lib/home/hero-selection";
import { isLiveTradableMarket } from "@/lib/panta/live";
import type { PantaMarket } from "@/lib/panta/types";

/**
 * Regression cover for the homepage hero showing a closed market.
 *
 * The hero frames its market as live. The previous selection used `.find()`
 * over the catalog with a final "any readable market" fallback, so it could
 * both pin one market indefinitely and surface a resolved or expired one.
 *
 * Randomness is injected everywhere below, so nothing here depends on
 * `Math.random` and no test is flaky.
 */

const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);
const HOUR = 3_600_000;

function market(overrides: Partial<PantaMarket> = {}): PantaMarket {
  return {
    marketId: "m1",
    category: "politics",
    title: "Will the rate be cut in March?",
    phase: "primary",
    endTime: new Date(NOW + 24 * HOUR).toISOString(),
    ...overrides,
  } as PantaMarket;
}

/** Deterministic stand-in for Math.random, cycling a fixed sequence. */
function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("isLiveTradableMarket", () => {
  it("accepts a primary market whose endTime is in the future", () => {
    expect(isLiveTradableMarket(market(), NOW)).toBe(true);
  });

  it("rejects a resolved phase", () => {
    expect(isLiveTradableMarket(market({ phase: "resolved" }), NOW)).toBe(false);
  });

  it("rejects a cancelled phase", () => {
    expect(isLiveTradableMarket(market({ phase: "cancelled" }), NOW)).toBe(false);
  });

  it("rejects a secondary phase", () => {
    expect(isLiveTradableMarket(market({ phase: "secondary" }), NOW)).toBe(false);
  });

  it("rejects resolved === true even when the phase still says primary", () => {
    expect(isLiveTradableMarket(market({ phase: "primary", resolved: true }), NOW)).toBe(
      false,
    );
  });

  it("rejects a primary market whose endTime has passed", () => {
    const past = new Date(NOW - HOUR).toISOString();
    expect(isLiveTradableMarket(market({ endTime: past }), NOW)).toBe(false);
  });

  it("handles endTime as integer Unix seconds", () => {
    const future = Math.floor((NOW + 6 * HOUR) / 1000);
    const past = Math.floor((NOW - 6 * HOUR) / 1000);
    expect(isLiveTradableMarket(market({ endTime: future }), NOW)).toBe(true);
    expect(isLiveTradableMarket(market({ endTime: past }), NOW)).toBe(false);
  });

  it("handles endTime as an ISO-8601 string", () => {
    expect(
      isLiveTradableMarket(market({ endTime: "2026-09-26T00:00:00Z" }), NOW),
    ).toBe(true);
    expect(
      isLiveTradableMarket(market({ endTime: "2026-09-24T00:00:00Z" }), NOW),
    ).toBe(false);
  });

  it("rejects a closed-looking status even when the phase says primary", () => {
    expect(isLiveTradableMarket(market({ status: "resolved" }), NOW)).toBe(false);
    expect(isLiveTradableMarket(market({ status: "CANCELLED" }), NOW)).toBe(false);
  });

  it("treats a missing or unparseable endTime as no information, not as expired", () => {
    expect(isLiveTradableMarket(market({ endTime: null }), NOW)).toBe(true);
    expect(isLiveTradableMarket(market({ endTime: "not a date" }), NOW)).toBe(true);
  });

  it("rejects a market exactly at its endTime", () => {
    expect(isLiveTradableMarket(market({ endTime: new Date(NOW).toISOString() }), NOW)).toBe(
      false,
    );
  });
});

describe("buildHeroCandidates", () => {
  const live = market({ marketId: "live" });
  const resolved = market({ marketId: "resolved", phase: "resolved" });
  const cancelled = market({ marketId: "cancelled", phase: "cancelled" });
  const expired = market({ marketId: "expired", endTime: new Date(NOW - HOUR).toISOString() });
  const flagged = market({ marketId: "flagged", resolved: true });
  const nameless = market({ marketId: "nameless", title: "", description: "" });

  it("excludes every closed or expired market", () => {
    const ids = buildHeroCandidates([resolved, cancelled, expired, flagged, live], {
      now: NOW,
      random: seeded([0]),
    }).map((m) => m.marketId);

    expect(ids).toEqual(["live"]);
  });

  it("keeps a live but nameless market eligible, ranked behind the named one", () => {
    // Panta's list endpoint returns an empty title for most rows while detail
    // carries the real question, so gating on a name emptied the hero while
    // real live markets existed.
    const ids = buildHeroCandidates([nameless, live], {
      now: NOW,
      random: seeded([0]),
    }).map((m) => m.marketId);

    expect(ids).toEqual(["live", "nameless"]);
  });

  it("ranks named+priced, named, priced, then neither", () => {
    const namedPriced = market({ marketId: "np", yesPrice: "0.5", noPrice: "0.5" });
    const namedOnly = market({ marketId: "n" });
    const pricedOnly = market({
      marketId: "p",
      title: "",
      description: "",
      yesPrice: "0.5",
      noPrice: "0.5",
    });
    const neither = market({ marketId: "x", title: "", description: "" });

    const ids = buildHeroCandidates([neither, pricedOnly, namedOnly, namedPriced], {
      now: NOW,
      random: seeded([0]),
    }).map((m) => m.marketId);

    expect(ids).toEqual(["np", "n", "p", "x"]);
  });

  it("never falls back to a closed market when nothing is live", () => {
    const candidates = buildHeroCandidates([resolved, cancelled, expired, flagged], {
      now: NOW,
      random: seeded([0]),
    });

    expect(candidates).toEqual([]);
  });

  it("prefers priced candidates but keeps unpriced ones eligible", () => {
    const priced = market({ marketId: "priced", yesPrice: "0.5", noPrice: "0.5" });
    const unpriced = market({ marketId: "unpriced" });

    const ids = buildHeroCandidates([unpriced, priced], {
      now: NOW,
      random: seeded([0]),
    }).map((m) => m.marketId);

    // Pricing is a preference, so the unpriced market is still eligible.
    expect(ids).toEqual(["priced", "unpriced"]);
  });

  it("keeps an unpriced live market eligible when no priced one exists", () => {
    const ids = buildHeroCandidates([market({ marketId: "only" })], {
      now: NOW,
      random: seeded([0]),
    }).map((m) => m.marketId);

    expect(ids).toEqual(["only"]);
  });

  it("does not always put the first catalog row first", () => {
    const pool = ["a", "b", "c", "d", "e"].map((id) => market({ marketId: id }));

    // Two different random sources must be able to produce two different leads.
    const first = buildHeroCandidates(pool, { now: NOW, random: seeded([0]) })[0];
    const second = buildHeroCandidates(pool, { now: NOW, random: seeded([0.99]) })[0];

    expect(first.marketId).not.toBe(second.marketId);
  });

  it("covers the whole eligible pool across many draws, not just the head", () => {
    const pool = ["a", "b", "c", "d", "e"].map((id) => market({ marketId: id }));
    const seen = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      // A real-ish random source, but seeded so the test is deterministic.
      let s = i + 1;
      const rng = () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
      seen.add(buildHeroCandidates(pool, { now: NOW, random: rng })[0].marketId);
    }

    expect(seen.size).toBe(pool.length);
  });

  it("leaves the caller's array untouched", () => {
    const pool = ["a", "b", "c"].map((id) => market({ marketId: id }));
    const before = pool.map((m) => m.marketId);

    buildHeroCandidates(pool, { now: NOW, random: seeded([0.4, 0.9, 0.1]) });

    expect(pool.map((m) => m.marketId)).toEqual(before);
  });
});

describe("shuffle", () => {
  it("is a permutation, never dropping or duplicating an item", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seeded([0.1, 0.7, 0.3, 0.9, 0.5]));

    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("stays in bounds for degenerate random sources", () => {
    const input = [1, 2, 3];
    expect([...shuffle(input, () => 1)].sort()).toEqual(input);
    expect([...shuffle(input, () => 0)].sort()).toEqual(input);
  });
});

describe("selectHeroMarket", () => {
  const trades = [{ marketId: "live", yesAmount: 1_000_000 }];

  it("returns the candidate with its merged detail and tape", async () => {
    const candidate = market({ marketId: "live", volumeUsdc: "189.98" });
    const fetchDetail = vi.fn().mockResolvedValue(
      market({ marketId: "live", yesPrice: "0.5", noPrice: "0.5", volumeUsdc: null }),
    );
    const fetchTrades = vi.fn().mockResolvedValue(trades);

    const result = await selectHeroMarket({
      candidates: [candidate],
      fetchDetail,
      fetchTrades,
      now: NOW,
    });

    expect(result?.market.marketId).toBe("live");
    // Detail supplies pricing; the catalog's volume survives the merge.
    expect(result?.market.yesPrice).toBe("0.5");
    expect(result?.market.volumeUsdc).toBe("189.98");
    expect(result?.trades).toEqual(trades);
    expect(result?.tradesUnavailable).toBe(false);
  });

  it("rejects a candidate that resolved between the catalog and detail reads", async () => {
    const fetchDetail = vi.fn().mockResolvedValue(market({ marketId: "a", phase: "resolved" }));

    const result = await selectHeroMarket({
      candidates: [market({ marketId: "a" })],
      fetchDetail,
      fetchTrades: vi.fn().mockResolvedValue([]),
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("rejects a candidate that expired between the catalog and detail reads", async () => {
    const fetchDetail = vi
      .fn()
      .mockResolvedValue(market({ marketId: "a", endTime: new Date(NOW - HOUR).toISOString() }));

    const result = await selectHeroMarket({
      candidates: [market({ marketId: "a" })],
      fetchDetail,
      fetchTrades: vi.fn().mockResolvedValue([]),
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("tries the next candidate when the first has gone stale", async () => {
    const fetchDetail = vi
      .fn()
      .mockResolvedValueOnce(market({ marketId: "a", phase: "cancelled" }))
      .mockResolvedValueOnce(market({ marketId: "b", yesPrice: "0.6", noPrice: "0.4" }));

    const result = await selectHeroMarket({
      candidates: [market({ marketId: "a" }), market({ marketId: "b" })],
      fetchDetail,
      fetchTrades: vi.fn().mockResolvedValue([]),
      now: NOW,
    });

    expect(result?.market.marketId).toBe("b");
    expect(fetchDetail).toHaveBeenCalledTimes(2);
  });

  it("gives up rather than looping when every candidate is stale", async () => {
    const fetchDetail = vi.fn().mockResolvedValue(market({ phase: "resolved" }));
    const candidates = ["a", "b", "c", "d", "e"].map((id) => market({ marketId: id }));

    const result = await selectHeroMarket({
      candidates,
      fetchDetail,
      fetchTrades: vi.fn().mockResolvedValue([]),
      now: NOW,
    });

    expect(result).toBeNull();
    expect(fetchDetail).toHaveBeenCalledTimes(MAX_HERO_ATTEMPTS);
  });

  it("returns null for an empty candidate pool without calling Panta", async () => {
    const fetchDetail = vi.fn();

    const result = await selectHeroMarket({
      candidates: [],
      fetchDetail,
      fetchTrades: vi.fn(),
      now: NOW,
    });

    expect(result).toBeNull();
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it("still renders when the tape fails, flagging it as unavailable", async () => {
    const result = await selectHeroMarket({
      candidates: [market({ marketId: "a" })],
      fetchDetail: vi.fn().mockResolvedValue(market({ marketId: "a" })),
      fetchTrades: vi.fn().mockRejectedValue(new Error("upstream")),
      now: NOW,
    });

    expect(result?.market.marketId).toBe("a");
    expect(result?.trades).toEqual([]);
    expect(result?.tradesUnavailable).toBe(true);
  });

  it("falls back to the catalog row when detail fails, since it passed the live check", async () => {
    const result = await selectHeroMarket({
      candidates: [market({ marketId: "a" })],
      fetchDetail: vi.fn().mockRejectedValue(new Error("upstream")),
      fetchTrades: vi.fn().mockResolvedValue([]),
      now: NOW,
    });

    expect(result?.market.marketId).toBe("a");
  });
});
