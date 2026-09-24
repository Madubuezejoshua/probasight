import "server-only";

import { pantaRequest } from "./client";
import type {
  PantaCategories,
  PantaMarket,
  PantaMarketsList,
  PantaMarketTrades,
  PantaWalletTrades,
} from "./types";

/** Public catalog data is safe to cache briefly; prices come from detail. */
const LIST_REVALIDATE_SECONDS = 30;
const DETAIL_REVALIDATE_SECONDS = 10;
const CATEGORIES_REVALIDATE_SECONDS = 3600;

export type ListMarketsParams = {
  category?: string;
  /** Panta calls this `status`, and it carries the market phase. */
  status?: string;
  createdBy?: "me";
  cursor?: string;
  limit?: number;
  /**
   * Bypass the shared cache for this call.
   *
   * Opt-in, so /markets and every other caller keeps its 30s cache. The
   * homepage hero uses it because it decides whether a market is still open
   * for trading, and deciding that from a catalog page up to 30s old can put a
   * just-closed market in the hero.
   */
  fresh?: boolean;
};

export async function listMarkets(params: ListMarketsParams = {}): Promise<PantaMarketsList> {
  const { data } = await pantaRequest<PantaMarketsList>({
    path: "/markets/",
    query: {
      category: params.category,
      status: params.status,
      createdBy: params.createdBy,
      cursor: params.cursor,
      limit: params.limit ? Math.min(Math.max(params.limit, 1), 50) : undefined,
    },
    revalidate: params.createdBy || params.fresh ? false : LIST_REVALIDATE_SECONDS,
  });
  return { items: data?.items ?? [], nextCursor: data?.nextCursor ?? null };
}

/** `fresh` bypasses the 10s cache; see the note on `ListMarketsParams.fresh`. */
export async function getMarket(
  marketId: string,
  options: { fresh?: boolean } = {},
): Promise<PantaMarket> {
  const { data } = await pantaRequest<PantaMarket>({
    path: `/markets/${encodeURIComponent(marketId)}/`,
    revalidate: options.fresh ? false : DETAIL_REVALIDATE_SECONDS,
  });
  return data;
}

export async function getMarketTrades(
  marketId: string,
  limit = 50,
): Promise<PantaMarketTrades> {
  const { data } = await pantaRequest<PantaMarketTrades>({
    path: `/markets/${encodeURIComponent(marketId)}/trades/`,
    query: { limit: Math.min(Math.max(limit, 1), 200) },
    revalidate: DETAIL_REVALIDATE_SECONDS,
  });
  return { marketId: data?.marketId ?? marketId, items: data?.items ?? [] };
}

/** Wallet-scoped, so never shared-cached. */
export async function getWalletTrades(
  wallet: string,
  limit = 50,
): Promise<PantaWalletTrades> {
  const { data } = await pantaRequest<PantaWalletTrades>({
    path: `/wallets/${encodeURIComponent(wallet)}/trades/`,
    query: { limit: Math.min(Math.max(limit, 1), 200) },
    revalidate: false,
  });
  return { wallet: data?.wallet ?? wallet, items: data?.items ?? [] };
}

export async function listCategories(): Promise<string[]> {
  const { data } = await pantaRequest<PantaCategories>({
    path: "/categories/",
    revalidate: CATEGORIES_REVALIDATE_SECONDS,
  });
  return data?.categories ?? [];
}
