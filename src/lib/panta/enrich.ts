import "server-only";

import { getMarket } from "./markets";
import type { PantaMarket } from "./types";

/**
 * Fills in spot prices for a bounded slice of catalog rows.
 *
 * `GET /markets/` deliberately returns `yesPrice`/`noPrice` as null — the docs
 * state list rows do not live-RPC for prices. Rather than show nothing or (far
 * worse) invent a price, we fetch detail for the first `limit` rows only.
 *
 * Both this call and `getMarket` run through Next's fetch cache with a short
 * revalidate window, so the cost is amortised across visitors instead of being
 * paid per page view. Rows beyond the limit keep their null prices and the UI
 * shows an honest "price on market page" state.
 */
export async function enrichMarketsWithPrices(
  markets: PantaMarket[],
  limit = 12,
): Promise<PantaMarket[]> {
  const targets = markets.slice(0, limit);

  const results = await Promise.allSettled(
    targets.map((market) => getMarket(market.marketId)),
  );

  const enriched = new Map<string, PantaMarket>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      enriched.set(targets[index].marketId, result.value);
    }
  });

  return markets.map((market) => {
    const detail = enriched.get(market.marketId);
    if (!detail) return market;
    return {
      ...market,
      yesPrice: detail.yesPrice ?? null,
      noPrice: detail.noPrice ?? null,
      primaryYesPrice: detail.primaryYesPrice ?? null,
      primaryNoPrice: detail.primaryNoPrice ?? null,
      secondaryYesPrice: detail.secondaryYesPrice ?? null,
      secondaryNoPrice: detail.secondaryNoPrice ?? null,
      // Detail is the fresher row for these too.
      volumeUsdc: detail.volumeUsdc ?? market.volumeUsdc,
      phase: detail.phase ?? market.phase,
      status: detail.status ?? market.status,
      outcome: detail.outcome ?? market.outcome,
    };
  });
}
