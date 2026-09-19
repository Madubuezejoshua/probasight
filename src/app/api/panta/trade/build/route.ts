import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseJsonBody } from "@/lib/api-route";
import { buildPrimaryBuy } from "@/lib/panta/orders";
import { tradeBuildSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseJsonBody(request, tradeBuildSchema);
    const build = await buildPrimaryBuy({
      quoteId: body.quoteId,
      wallet: body.wallet,
      maxSlippageBps: body.maxSlippageBps,
      userId: body.userId,
    });
    return okResponse(build);
  } catch (err) {
    return errorResponse(err);
  }
}
