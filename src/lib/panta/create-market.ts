import "server-only";

import { pantaRequest } from "./client";
import type {
  PantaCreateBuild,
  PantaCreateQuote,
  PantaCreateRegister,
  PantaImageUpload,
} from "./types";

/**
 * Market creation lifecycle:
 *   image-upload (optional) -> quote (createId, ~5min) -> build (base64 tx)
 *   -> wallet sign -> broadcast -> register
 */

export type CreateMarketQuoteInput = {
  wallet: string;
  question: string;
  resolutionRule: string;
  sourcesOfTruth: string[];
  category: string;
  startTime: number;
  endTime: number;
  resolutionTime: number;
  imageUrl: string;
  marketType?: "standard" | "breaking";
  eventInProgress?: boolean;
  title?: string;
  description?: string;
  region?: string;
};

export async function quoteCreateMarket(
  input: CreateMarketQuoteInput,
): Promise<PantaCreateQuote> {
  const { data } = await pantaRequest<PantaCreateQuote>({
    path: "/markets/create/quote/",
    method: "POST",
    body: input,
  });
  return data;
}

export async function buildCreateMarket(input: {
  createId: string;
  wallet?: string;
}): Promise<PantaCreateBuild> {
  const { data } = await pantaRequest<PantaCreateBuild>({
    path: "/markets/create/build/",
    method: "POST",
    body: {
      createId: input.createId,
      ...(input.wallet ? { wallet: input.wallet } : {}),
    },
  });
  return data;
}

export async function registerCreatedMarket(input: {
  createId: string;
  signature: string;
}): Promise<PantaCreateRegister> {
  const { data } = await pantaRequest<PantaCreateRegister>({
    path: "/markets/register/",
    method: "POST",
    body: { createId: input.createId, signature: input.signature },
  });
  return data;
}

/**
 * Returns a short-lived signed Cloudinary upload form. Image bytes never pass
 * through Panta, and never through this server either: the browser posts the
 * file directly to uploadUrl using these fields.
 */
export async function createImageUploadSignature(): Promise<PantaImageUpload> {
  const { data } = await pantaRequest<PantaImageUpload>({
    path: "/markets/create/image-upload/",
    method: "POST",
    body: {},
  });
  return data;
}
