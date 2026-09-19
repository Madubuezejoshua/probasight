import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { verifyPrimaryBuy } from "@/lib/panta/orders";
import { tradeVerifySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Returns Panta's current order status: built/submitted/confirmed/failed/expired. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, tradeVerifySchema);
    const result = await verifyPrimaryBuy({
      orderId: body.orderId,
      signature: body.signature,
      wallet: body.wallet,
    });
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
