import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { analyseMarket } from "@/lib/ai/groq";
import { buildMarketContext, hasAnalysableQuestion } from "@/lib/ai/market-context";
import type { MarketAnalysisResponse } from "@/lib/ai/schema";
import { AppError } from "@/lib/panta/errors";
import { getMarket, getMarketTrades } from "@/lib/panta/markets";
import type { PantaMarket } from "@/lib/panta/types";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { marketAnalysisSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Trade rows included in the analysis context. */
const TRADE_SAMPLE_SIZE = 40;

/**
 * Bounded re-fetch for a detail row that arrives with no question text.
 *
 * Panta's market detail endpoint intermittently returns HTTP 200 with both
 * `title` and `description` empty for a market that has a real question.
 * Verified by observation: repeated calls for the SAME marketId alternate
 * between a populated row and an empty one. Because the response is a 200 and
 * not an error code, the transient retry in `lib/panta/client` does not fire.
 *
 * Without this, a market with a perfectly good question is refused with
 * MARKET_QUESTION_UNAVAILABLE roughly half the time. The refusal itself is
 * correct and is kept: if the question is still missing after these attempts,
 * the request is refused rather than handing the model a nameless market.
 */
const QUESTION_ATTEMPTS = 3;
const QUESTION_BACKOFF_MS = [200, 500];

async function getMarketWithQuestion(marketId: string): Promise<PantaMarket> {
  let market = await getMarket(marketId);
  for (let attempt = 1; attempt < QUESTION_ATTEMPTS; attempt += 1) {
    if (hasAnalysableQuestion(market)) return market;
    await new Promise((resolve) =>
      setTimeout(resolve, QUESTION_BACKOFF_MS[attempt - 1] ?? 500),
    );
    market = await getMarket(marketId);
  }
  return market;
}

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
      getMarketWithQuestion(marketId),
      // A missing tape must not block analysis; the context records the gap.
      getMarketTrades(marketId, TRADE_SAMPLE_SIZE).catch(() => ({
        marketId,
        items: [],
      })),
    ]);

    // Hard guard, reached only after the re-fetch above has exhausted its
    // attempts. Some catalog rows genuinely have no title AND no description,
    // and a model given one will invent a plausible-sounding question rather
    // than admit it does not know. Refusing is the only truthful response.
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
