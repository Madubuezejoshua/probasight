import { NextResponse } from "next/server";
import { errorResponse, okResponse } from "@/lib/api-route";
import { createImageUploadSignature } from "@/lib/panta/create-market";

export const dynamic = "force-dynamic";

/**
 * Returns Panta's short-lived signed Cloudinary upload form.
 *
 * Image bytes never touch this server: the browser posts the file directly to
 * the returned uploadUrl with these fields. Only the signing call needs the
 * developer API key, which stays here.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const upload = await createImageUploadSignature();
    return okResponse(upload);
  } catch (err) {
    return errorResponse(err);
  }
}
