import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { buildCreateMarket } from "@/lib/panta/create-market";
import { createBuildSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Returns a base64 unsigned VersionedTransaction for the quoted create.
 * Safe to call again on the same createId when the blockhash expires.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, createBuildSchema);
    const build = await buildCreateMarket({
      createId: body.createId,
      wallet: body.wallet,
    });
    return okResponse(build);
  } catch (err) {
    return errorResponse(err);
  }
}
