import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { quoteCreateMarket } from "@/lib/panta/create-market";
import { createMarketQuoteSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Reserves a create session (~5 min) and returns the on-chain creation fee. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, createMarketQuoteSchema);
    const quote = await quoteCreateMarket({
      wallet: body.wallet,
      question: body.question,
      resolutionRule: body.resolutionRule,
      sourcesOfTruth: body.sourcesOfTruth,
      category: body.category,
      startTime: body.startTime,
      endTime: body.endTime,
      resolutionTime: body.resolutionTime,
      imageUrl: body.imageUrl,
      marketType: body.marketType,
      eventInProgress: body.eventInProgress,
      title: body.title,
      description: body.description,
      region: body.region,
    });
    return okResponse(quote);
  } catch (err) {
    return errorResponse(err);
  }
}
