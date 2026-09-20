import "server-only";

import { pantaRequest } from "./client";
import type { PantaCreatorFeesBuild, PantaWinClaimBuild } from "./types";

/** Redeem winning shares on a resolved market. Reportable to /trades/ as kind: claim. */
export async function buildWinClaim(input: {
  wallet: string;
  marketId: string;
}): Promise<PantaWinClaimBuild> {
  const { data } = await pantaRequest<PantaWinClaimBuild>({
    path: "/claim/build/",
    method: "POST",
    body: { wallet: input.wallet, marketId: input.marketId },
  });
  return data;
}

/**
 * Withdraw accumulated creator fees on a graduated market.
 *
 * Per Panta docs this signature is NOT attributable via POST /trades/,
 * reporting it returns TX_MISMATCH. The creator-fee flow therefore ends at
 * broadcast plus on-chain confirmation, with no trade report.
 */
export async function buildCreatorFeesClaim(input: {
  wallet: string;
  marketId: string;
}): Promise<PantaCreatorFeesBuild> {
  const { data } = await pantaRequest<PantaCreatorFeesBuild>({
    path: "/claim/creator-fees/build/",
    method: "POST",
    body: { wallet: input.wallet, marketId: input.marketId },
  });
  return data;
}
