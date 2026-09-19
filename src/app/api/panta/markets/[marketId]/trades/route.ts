import { NextResponse } from "next/server";
import { errorResponse, okResponse } from "@/lib/api-route";
import { AppError } from "@/lib/panta/errors";
import { getMarketTrades } from "@/lib/panta/markets";
import { marketIdSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ marketId: string }> },
): Promise<NextResponse> {
  try {
    const { marketId } = await context.params;
    const parsed = marketIdSchema.safeParse(marketId);
    if (!parsed.success) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "That market id is not a valid Solana address.",
        status: 400,
        retryable: false,
      });
    }

    const limitParam = new URL(request.url).searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 50;
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

    const trades = await getMarketTrades(parsed.data, safeLimit);
    return okResponse(trades);
  } catch (err) {
    return errorResponse(err);
  }
}
