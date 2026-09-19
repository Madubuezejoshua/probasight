import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { buildWinClaim } from "@/lib/panta/claims";
import { claimBuildSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Builds unsigned claim_win_usdc instructions. Panta re-validates eligibility
 * on-chain and fails closed, so the UI never claims before Panta agrees.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, claimBuildSchema);
    const build = await buildWinClaim({ wallet: body.wallet, marketId: body.marketId });
    return okResponse(build);
  } catch (err) {
    return errorResponse(err);
  }
}
