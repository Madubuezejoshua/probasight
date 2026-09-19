import { NextResponse } from "next/server";
import { errorResponse, okResponse, parseQuery } from "@/lib/api-route";
import { listMarkets } from "@/lib/panta/markets";
import { listMarketsQuerySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const query = parseQuery(request, listMarketsQuerySchema);
    const result = await listMarkets({
      category: query.category,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit ?? 24,
      createdBy: query.createdBy,
    });
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
