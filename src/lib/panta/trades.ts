import "server-only";

import { pantaRequest } from "./client";
import type { PantaTradeReport, PantaTradeStatus } from "./types";

/**
 * Trade attribution. Panta accepts primary buys (kind: buy) and win claims
 * (kind: claim) only. Creator-fee claims are rejected with TX_MISMATCH and
 * must never be reported here.
 */
export async function reportTrade(input: {
  signature: string;
  wallet: string;
  marketId: string;
  quoteId?: string;
  clientOrderId?: string;
  userId?: string;
}): Promise<PantaTradeReport> {
  const { data } = await pantaRequest<PantaTradeReport>({
    path: "/trades/",
    method: "POST",
    body: {
      signature: input.signature,
      wallet: input.wallet,
      marketId: input.marketId,
      ...(input.quoteId ? { quoteId: input.quoteId } : {}),
      ...(input.clientOrderId ? { clientOrderId: input.clientOrderId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
    },
    userId: input.userId,
  });
  return data;
}

export async function getTradeStatus(
  signature: string,
  userId?: string,
): Promise<PantaTradeStatus> {
  const { data } = await pantaRequest<PantaTradeStatus>({
    path: `/trades/${encodeURIComponent(signature)}/`,
    query: { userId },
    revalidate: false,
  });
  return data;
}
