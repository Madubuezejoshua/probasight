import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { submitPrimaryBuy } from "@/lib/panta/orders";
import { tradeSubmitSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Registers the broadcast signature with Panta. Idempotent per orderId+signature. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, tradeSubmitSchema);
    const result = await submitPrimaryBuy({
      orderId: body.orderId,
      signature: body.signature,
      wallet: body.wallet,
    });
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
