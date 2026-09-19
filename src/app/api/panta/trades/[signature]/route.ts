import { NextResponse } from "next/server";
import { errorResponse, okResponse } from "@/lib/api-route";
import { AppError } from "@/lib/panta/errors";
import { getTradeStatus } from "@/lib/panta/trades";
import { signatureSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Attribution / confirmation status for a broadcast signature. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ signature: string }> },
): Promise<NextResponse> {
  try {
    const { signature } = await context.params;
    const parsed = signatureSchema.safeParse(signature);
    if (!parsed.success) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "That is not a valid Solana transaction signature.",
        status: 400,
        retryable: false,
      });
    }
    const status = await getTradeStatus(parsed.data);
    return okResponse(status);
  } catch (err) {
    return errorResponse(err);
  }
}
