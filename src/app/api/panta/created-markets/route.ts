import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseQuery } from "@/lib/api-route";
import { listMarkets } from "@/lib/panta/markets";
import type { PantaMarket } from "@/lib/panta/types";
import { walletQuerySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Markets created through this application, for the Created Markets tab.
 *
 * Panta scopes creation history to the API ACCOUNT rather than to a wallet.
 * There are two ways to ask for it, and we need both:
 *
 *  1. `GET /markets/?createdBy=me`, the documented path. Against the live
 *     catalog this currently returns `400 INVALID_MARKET_PARAMS
 *     ("limit must be an integer")` regardless of what `limit` is set to, and
 *     even when it is omitted entirely, so it cannot be relied on.
 *
 *  2. The general catalog, filtered on each row's `createdByPartner` flag,
 *     which the docs define as "true when this account has a create metric for
 *     that marketId", the same question, answered from data that does work.
 *
 * We try the documented path first and fall back to the flag, so this keeps
 * working if Panta fixes the endpoint.
 *
 * Wallet scoping: catalog rows are not documented to carry a creator wallet.
 * When `creatorAddress` is present we filter to the connected wallet; otherwise
 * we return the account's markets and flag it so the UI can say so. Panta
 * remains authoritative, a creator-fee claim from a non-creator wallet is
 * rejected with NOT_MARKET_CREATOR.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { wallet } = parseQuery(request, walletQuerySchema);

    let rows: PantaMarket[] = [];
    let source: "createdBy" | "partnerFlag" = "createdBy";

    try {
      const pages: PantaMarket[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 3; page += 1) {
        const result = await listMarkets({ createdBy: "me", limit: 50, cursor });
        pages.push(...result.items);
        if (!result.nextCursor || result.nextCursor === cursor) break;
        cursor = result.nextCursor;
      }
      rows = pages;
    } catch {
      // Documented path unavailable, derive the same set from the catalog.
      source = "partnerFlag";
      const catalog = await listMarkets({ limit: 50 });
      rows = catalog.items.filter((market) => market.createdByPartner === true);
    }

    const exposesCreator = rows.some(
      (market) => typeof market.creatorAddress === "string" && market.creatorAddress,
    );
    const markets = exposesCreator
      ? rows.filter((market) => market.creatorAddress === wallet)
      : rows;

    return okResponse({
      wallet,
      markets,
      creatorFilterApplied: exposesCreator,
      source,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
