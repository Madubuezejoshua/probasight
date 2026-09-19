import { NextResponse } from "next/server";
import { errorResponse, okResponse } from "@/lib/api-route";
import { listCategories } from "@/lib/panta/categories";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const categories = await listCategories();
    return okResponse({ categories });
  } catch (err) {
    return errorResponse(err);
  }
}
