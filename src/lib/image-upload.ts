"use client";

import { apiFetch } from "@/lib/client-api";
import type { PantaImageUpload } from "@/lib/panta/types";

/**
 * Panta market image upload.
 *
 * Our server asks Panta for a short-lived signed Cloudinary form (that call
 * needs the developer key), then the browser posts the bytes straight to
 * Cloudinary. The image never passes through Panta or through this server, and
 * no extra storage provider is introduced.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export function validateMarketImage(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    return "Use a PNG, JPEG, WebP or GIF image.";
  }
  if (file.size <= 0) return "That image file is empty.";
  if (file.size > MAX_BYTES) return "Image must be 5MB or smaller.";
  return null;
}

export async function uploadMarketImage(file: File): Promise<string> {
  const validation = validateMarketImage(file);
  if (validation) throw new Error(validation);

  const upload = await apiFetch<PantaImageUpload>("/api/panta/create/image", {
    method: "POST",
    body: {},
  });

  if (!upload.uploadUrl || !upload.fields) {
    throw new Error("Panta returned an incomplete image upload signature.");
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) {
    if (value === undefined || value === null) continue;
    form.append(key, String(value));
  }
  form.append("file", file);

  const res = await fetch(upload.uploadUrl, { method: "POST", body: form });
  const text = await res.text();

  let parsed: { secure_url?: string; error?: { message?: string } } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // Cloudinary can return a non-JSON error body.
  }

  if (!res.ok) {
    throw new Error(
      parsed.error?.message || `Image upload failed (${res.status}). Try another image.`,
    );
  }

  const secureUrl = parsed.secure_url?.trim();
  if (!secureUrl) throw new Error("Image upload did not return a public URL.");
  return secureUrl;
}
