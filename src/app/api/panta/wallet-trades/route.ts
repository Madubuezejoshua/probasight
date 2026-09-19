import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseQuery } from "@/lib/api-route";
import { getWalletTrades } from "@/lib/panta/markets";
import { walletQuerySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { wallet, limit } = parseQuery(request, walletQuerySchema);
    const trades = await getWalletTrades(wallet, limit ?? 50);
    return okResponse(trades);
  } catch (err) {
    return errorResponse(err);
  }
}
