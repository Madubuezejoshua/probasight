import { isLiveTradableMarket } from "@/lib/panta/live";
import type { PantaCatalogTrade, PantaMarket } from "@/lib/panta/types";

/**
 * Picks the market shown in the homepage hero card.
 *
 * Two rules drive this module.
 *
 * The hero must never show a closed market. It is the first thing a visitor
 * sees and it is framed as live, so a resolved, cancelled or expired market
 * there is a false claim about the product. There is deliberately NO fallback
 * to a closed market to keep the card populated: if nothing is live, the hero
 * renders nothing.
 *
 * The hero must not behave like a pinned market. The previous implementation
 * used `.find()` over the catalog, so the same first eligible row appeared on
 * every request and could sit there for days. Selection is now a random draw
 * from the whole eligible pool, done on the server.
 *
 * Randomness is injected rather than calling `Math.random` directly so the
 * rotation can be tested deterministically.
 */

export type RandomSource = () => number;

export type HeroSelection = {
  market: PantaMarket;
  trades: PantaCatalogTrade[];
  /** True when the tape request failed, which is not the same as no trades. */
  tradesUnavailable: boolean;
};

/** Candidates tried before giving up, so a bad run cannot become a long loop. */
export const MAX_HERO_ATTEMPTS = 3;

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: T[], random: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const target = Math.min(Math.max(j, 0), i);
    [out[i], out[target]] = [out[target], out[i]];
  }
  return out;
}

/** Both sides priced. Panta returns pricing on detail, not on catalog rows. */
export function hasPricing(market: PantaMarket): boolean {
  return (
    market.yesPrice !== null &&
    market.yesPrice !== undefined &&
    market.noPrice !== null &&
    market.noPrice !== undefined
  );
}

/** A market a visitor can actually read: it has a title or a description. */
export function hasUsableName(market: PantaMarket): boolean {
  return Boolean(market.title?.trim() || market.description?.trim());
}

/**
 * Overlays `next` onto `base`, ignoring keys whose new value is null,
 * undefined or an empty string.
 *
 * Panta's detail and catalog rows are each authoritative for different fields:
 * detail carries YES/NO pricing that list rows never have, while a list row can
 * carry a volume that the detail row returns as null. Preferring whichever
 * response actually has a value keeps both rather than letting the later one
 * blank out the earlier.
 */
export function mergeDefined(base: PantaMarket, next: PantaMarket): PantaMarket {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value;
    }
  }
  return merged as PantaMarket;
}

/**
 * Eligible hero markets, in the order they should be tried.
 *
 * Being live is the ONLY hard requirement. A readable name and pricing are
 * preferences that order the pool, never gates: both are missing from catalog
 * rows more often than not, and gating on either emptied the hero while real
 * live markets existed. Panta's list endpoint returns an empty `title` for most
 * rows while the detail endpoint carries the real question, so an apparently
 * nameless candidate usually gains its name once detail is fetched.
 *
 * Candidates are ranked into four tiers, best first, and each tier is shuffled
 * independently. That keeps the preference meaningful while still rotating,
 * rather than letting the preference pin one market the way `.find()` did.
 */
export function buildHeroCandidates(
  markets: PantaMarket[],
  options: { now?: number; random: RandomSource },
): PantaMarket[] {
  const { now = Date.now(), random } = options;

  const live = markets.filter((market) => isLiveTradableMarket(market, now));

  // 0 = named and priced, 1 = named, 2 = priced, 3 = neither.
  const tiers: PantaMarket[][] = [[], [], [], []];
  for (const market of live) {
    const rank = (hasUsableName(market) ? 0 : 2) + (hasPricing(market) ? 0 : 1);
    tiers[rank].push(market);
  }

  return tiers.flatMap((tier) => shuffle(tier, random));
}

/**
 * Resolves a candidate into a renderable hero, re-checking liveness.
 *
 * A market can close between the catalog read and the detail read, and detail
 * is the fresher of the two. So after merging, liveness is checked AGAIN, and a
 * candidate that has since resolved, cancelled or expired is discarded and the
 * next candidate tried. Bounded by `maxAttempts`.
 *
 * If the detail request itself fails, the catalog row already passed the live
 * check and is used as-is. That is a deliberate degradation: an upstream blip
 * should not blank the hero, and the card renders its own honest states for
 * whatever data is missing.
 */
export async function selectHeroMarket(params: {
  candidates: PantaMarket[];
  fetchDetail: (marketId: string) => Promise<PantaMarket>;
  fetchTrades: (marketId: string) => Promise<PantaCatalogTrade[]>;
  now?: number;
  maxAttempts?: number;
}): Promise<HeroSelection | null> {
  const {
    candidates,
    fetchDetail,
    fetchTrades,
    now = Date.now(),
    maxAttempts = MAX_HERO_ATTEMPTS,
  } = params;

  const attempts = Math.min(candidates.length, maxAttempts);

  for (let index = 0; index < attempts; index += 1) {
    const candidate = candidates[index];

    const [detail, tape] = await Promise.allSettled([
      fetchDetail(candidate.marketId),
      fetchTrades(candidate.marketId),
    ]);

    const market =
      detail.status === "fulfilled" ? mergeDefined(candidate, detail.value) : candidate;

    // Detail is fresher than the catalog, so it gets the final say.
    if (detail.status === "fulfilled" && !isLiveTradableMarket(market, now)) {
      continue;
    }

    return {
      market,
      trades: tape.status === "fulfilled" ? tape.value : [],
      tradesUnavailable: tape.status !== "fulfilled",
    };
  }

  return null;
}
