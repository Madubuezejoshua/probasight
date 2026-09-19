import "server-only";

import { getMarket } from "./markets";
import type { PantaMarket } from "./types";

/**
 * Fills in the fields the list endpoint omits, for a bounded slice of rows.
 *
 * `GET /markets/` is a lighter projection than `GET /markets/{id}/`. Two fields
 * differ and both matter:
 *
 *  - **prices.** The docs state list rows do not live-RPC, so `yesPrice` and
 *    `noPrice` arrive null.
 *  - **title.** Verified against production: the same market returns
 *    `title: ""` on the list and its real question on detail. Without this,
 *    cards fall back to naming a market by its id even though Panta does know
 *    what it asks.
 *
 * Both this call and `getMarket` run through Next's fetch cache with a short
 * revalidate window, so the cost is amortised across visitors rather than paid
 * per page view. Rows beyond the limit keep their list values, and the UI shows
 * honest fallbacks for whatever is still missing.
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
      // Detail carries the question text the list projection drops. Only take
      // it when it is actually populated, so an empty detail title never wipes
      // a list title that happened to be present.
      title: detail.title?.trim() ? detail.title : market.title,
      description: detail.description?.trim() ? detail.description : market.description,
      oracle: detail.oracle ?? market.oracle,
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
