import "server-only";

import { pantaRequest } from "./client";
import type {
  MarketSide,
  PantaPrimaryBuild,
  PantaPrimaryQuote,
  PantaPrimarySubmit,
  PantaPrimaryVerify,
} from "./types";

/**
 * Panta primary buy lifecycle:
 *   quote (~90s) -> build (~120s, returns instructions) -> broadcast -> submit -> verify
 *
 * Build returns instructions rather than an assembled transaction, so the
 * browser compiles them into a v0 transaction with the returned blockhash.
 */

export async function quotePrimaryBuy(input: {
  wallet: string;
  marketId: string;
  side: MarketSide;
  amountUsdc: string;
  userId?: string;
}): Promise<PantaPrimaryQuote> {
  const { data } = await pantaRequest<PantaPrimaryQuote>({
    path: "/primaryorderquote/",
    method: "POST",
    body: {
      wallet: input.wallet,
      marketId: input.marketId,
      side: input.side,
      amountUsdc: input.amountUsdc,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    userId: input.userId,
  });
  return data;
}

export async function buildPrimaryBuy(input: {
  quoteId: string;
  wallet: string;
  maxSlippageBps?: number;
  userId?: string;
}): Promise<PantaPrimaryBuild> {
  const { data } = await pantaRequest<PantaPrimaryBuild>({
    path: "/primaryorderbuild/",
    method: "POST",
    body: {
      quoteId: input.quoteId,
      wallet: input.wallet,
      ...(input.maxSlippageBps !== undefined
        ? { maxSlippageBps: input.maxSlippageBps }
        : {}),
      ...(input.userId ? { userId: input.userId } : {}),
    },
    userId: input.userId,
  });
  return data;
}

export async function submitPrimaryBuy(input: {
  orderId: string;
  signature: string;
  wallet?: string;
}): Promise<PantaPrimarySubmit> {
  const { data } = await pantaRequest<PantaPrimarySubmit>({
    path: "/primaryordersubmit/",
    method: "POST",
    body: {
      orderId: input.orderId,
      signature: input.signature,
      ...(input.wallet ? { wallet: input.wallet } : {}),
    },
  });
  return data;
}

export async function verifyPrimaryBuy(input: {
  orderId: string;
  signature?: string;
  wallet?: string;
}): Promise<PantaPrimaryVerify> {
  const { data } = await pantaRequest<PantaPrimaryVerify>({
    path: "/primaryorderverify/",
    method: "POST",
    body: {
      orderId: input.orderId,
      ...(input.signature ? { signature: input.signature } : {}),
      ...(input.wallet ? { wallet: input.wallet } : {}),
    },
  });
  return data;
}
