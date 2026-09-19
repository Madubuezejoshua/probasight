import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { buildCreatorFeesClaim } from "@/lib/panta/claims";
import { claimBuildSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Builds unsigned claim_creator_fees_usdc instructions for a graduated market.
 *
 * Note the deliberate asymmetry with the win-claim flow: per Panta docs, a
 * creator-fee signature must NOT be sent to POST /trades/ (it returns
 * TX_MISMATCH), so this flow ends at broadcast plus confirmation.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, claimBuildSchema);
    const build = await buildCreatorFeesClaim({
      wallet: body.wallet,
      marketId: body.marketId,
    });
    return okResponse(build);
  } catch (err) {
    return errorResponse(err);
  }
}
