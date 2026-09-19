import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { quotePrimaryBuy } from "@/lib/panta/orders";
import { tradeQuoteSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, tradeQuoteSchema);
    const quote = await quotePrimaryBuy({
      wallet: body.wallet,
      marketId: body.marketId,
      side: body.side,
      amountUsdc: body.amountUsdc,
      userId: body.userId,
    });
    return okResponse(quote);
  } catch (err) {
    return errorResponse(err);
  }
}
