import { NextResponse } from "next/server";
import { errorResponse, okResponse } from "@/lib/api-route";
import { AppError } from "@/lib/panta/errors";
import { getMarket } from "@/lib/panta/markets";
import { marketIdSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
    const market = await getMarket(parsed.data);
    return okResponse(market);
  } catch (err) {
    return errorResponse(err);
  }
}
