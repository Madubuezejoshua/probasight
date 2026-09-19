import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { reportTrade } from "@/lib/panta/trades";
import { tradeReportSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Explicit Panta trade attribution.
 *
 * Accepts primary buys and win claims only. Creator-fee claim signatures are
 * rejected upstream with TX_MISMATCH and are never sent here by this app.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, tradeReportSchema);
    const result = await reportTrade({
      signature: body.signature,
      wallet: body.wallet,
      marketId: body.marketId,
      quoteId: body.quoteId,
      clientOrderId: body.clientOrderId,
      userId: body.userId,
    });
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
