import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { analyseMarket } from "@/lib/ai/groq";
import { buildMarketContext, hasAnalysableQuestion } from "@/lib/ai/market-context";
import type { MarketAnalysisResponse } from "@/lib/ai/schema";
import { AppError } from "@/lib/panta/errors";
import { getMarket, getMarketTrades } from "@/lib/panta/markets";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { marketAnalysisSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Trade rows included in the analysis context. */
const TRADE_SAMPLE_SIZE = 40;

/**
 * AI Market Intelligence.
 *
 * The model only ever sees a snapshot assembled here from live Panta data,
 * market detail plus the market trade tape. There is no news feed and no web
 * access, and the prompt states that explicitly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    rateLimit({ key: `ai:${clientKey(request)}`, limit: 10, windowMs: 60_000 });

    const { marketId } = await parseJsonBody(request, marketAnalysisSchema);

    const [market, trades] = await Promise.all([
      getMarket(marketId),
      // A missing tape must not block analysis; the context records the gap.
      getMarketTrades(marketId, TRADE_SAMPLE_SIZE).catch(() => ({
        marketId,
        items: [],
      })),
    ]);

    // Hard guard. Some live catalog rows have no title AND no description, and
    // a model given one will invent a plausible-sounding question rather than
    // admit it does not know. Refusing is the only truthful response.
    if (!hasAnalysableQuestion(market)) {
      throw new AppError({
        code: "MARKET_QUESTION_UNAVAILABLE",
        message:
          "This market has no question text in Panta's catalog. Both its title and description are empty. Analysis is not possible without knowing what the market asks, and inferring a question would be fabrication.",
        status: 422,
        retryable: false,
      });
    }

    const context = buildMarketContext(market, trades.items);
    const { analysis, model } = await analyseMarket(context);

    const payload: MarketAnalysisResponse = {
      analysis,
      generatedAt: new Date().toISOString(),
      model,
      marketId,
    };
    return okResponse(payload);
  } catch (err) {
    return errorResponse(err);
  }
}
