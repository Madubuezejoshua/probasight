import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { registerCreatedMarket } from "@/lib/panta/create-market";
import { createRegisterSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Verifies the confirmed on-chain create and writes catalog metadata.
 * Panta verification is fail-closed; idempotent on the same createId+signature.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, createRegisterSchema);
    const result = await registerCreatedMarket({
      createId: body.createId,
      signature: body.signature,
    });
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
