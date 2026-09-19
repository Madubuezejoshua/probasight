import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseQuery } from "@/lib/api-route";
import { getMarket } from "@/lib/panta/markets";
import { listPositions } from "@/lib/panta/positions";
import { marketTitle } from "@/lib/panta/display";
import type { PantaMarket, PantaPosition } from "@/lib/panta/types";
import { walletQuerySchema } from "@/lib/validation/schemas";
import { estimatePositionValueUsdc } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/**
 * Wallet positions, enriched with the market detail needed to value them.
 *
 * Panta returns share counts only. Per the docs, estimating value requires a
 * per-market detail lookup for spot prices. We fetch each DISTINCT marketId
 * once (positions split YES/NO into separate rows for the same market), and we
 * cap the fan-out so a large wallet cannot trigger an abusive burst.
 */
const MAX_MARKET_LOOKUPS = 24;

export type EnrichedPosition = PantaPosition & {
  market: Pick<
    PantaMarket,
    | "marketId"
    | "title"
    | "category"
    | "images"
    | "phase"
    | "endTime"
    | "resolutionTime"
    | "yesPrice"
    | "noPrice"
    | "volumeUsdc"
    | "status"
    | "outcome"
  > | null;
  /** null when no honest valuation reference exists. */
  estimatedValueUsdc: number | null;
};

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { wallet } = parseQuery(request, walletQuerySchema);
    const { positions } = await listPositions(wallet);

    const uniqueMarketIds = [...new Set(positions.map((p) => p.marketId))];
    const lookupIds = uniqueMarketIds.slice(0, MAX_MARKET_LOOKUPS);

    const markets = new Map<string, PantaMarket>();
    const results = await Promise.allSettled(lookupIds.map((id) => getMarket(id)));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") markets.set(lookupIds[index], result.value);
    });

    const enriched: EnrichedPosition[] = positions.map((position) => {
      const market = markets.get(position.marketId) ?? null;
      const estimatedValueUsdc = market
        ? estimatePositionValueUsdc({
            shares: position.shares,
            side: position.side,
            phase: position.phase,
            outcome: position.outcome ?? market.outcome ?? null,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
          })
        : null;

      return {
        ...position,
        market: market
          ? {
              marketId: market.marketId,
              title: marketTitle(market),
              category: market.category,
              images: market.images,
              phase: market.phase,
              endTime: market.endTime,
              resolutionTime: market.resolutionTime,
              yesPrice: market.yesPrice,
              noPrice: market.noPrice,
              volumeUsdc: market.volumeUsdc,
              status: market.status,
              outcome: market.outcome,
            }
          : null,
        estimatedValueUsdc,
      };
    });

    return okResponse({
      wallet,
      positions: enriched,
      /** True when some positions could not be valued because detail was skipped. */
      truncatedMarketLookups: uniqueMarketIds.length > lookupIds.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
