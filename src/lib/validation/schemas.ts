import { z } from "zod";

/**
 * Input validation for our own route handlers.
 *
 * These guard the boundary between the browser and our server. Panta performs
 * its own authoritative validation; these schemas exist so we reject obvious
 * abuse early and return a structured error the UI can render.
 */

/** Base58 alphabet, 32-44 chars — the shape of a Solana public key. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Base58 transaction signature (64 bytes encoded). */
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

export const walletSchema = z
  .string()
  .trim()
  .regex(BASE58, "Must be a base58 Solana public key");

export const marketIdSchema = z
  .string()
  .trim()
  .regex(BASE58, "Must be a base58 market (event) address");

export const signatureSchema = z
  .string()
  .trim()
  .regex(SIGNATURE, "Must be a base58 transaction signature");

export const sideSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(["yes", "no"]));

/** Positive, finite USDC amount with at most 6 decimal places. */
export const usdcAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? String(value) : value.trim()))
  .refine((value) => /^\d+(\.\d{1,6})?$/.test(value), {
    message: "Amount must be a positive number with up to 6 decimal places",
  })
  .refine((value) => Number(value) > 0, { message: "Amount must be greater than zero" })
  .refine((value) => Number(value) <= 1_000_000, {
    message: "Amount exceeds the supported maximum",
  });

export const attributionUserIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid attribution id")
  .optional();

// ---------------------------------------------------------------- trading

export const tradeQuoteSchema = z.object({
  wallet: walletSchema,
  marketId: marketIdSchema,
  side: sideSchema,
  amountUsdc: usdcAmountSchema,
  userId: attributionUserIdSchema,
});

export const tradeBuildSchema = z.object({
  quoteId: z.string().trim().min(1).max(200),
  wallet: walletSchema,
  maxSlippageBps: z.number().int().min(1).max(5000).optional(),
  userId: attributionUserIdSchema,
});

export const tradeSubmitSchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  signature: signatureSchema,
  wallet: walletSchema.optional(),
});

export const tradeVerifySchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  signature: signatureSchema.optional(),
  wallet: walletSchema.optional(),
});

export const tradeReportSchema = z.object({
  signature: signatureSchema,
  wallet: walletSchema,
  marketId: marketIdSchema,
  quoteId: z.string().trim().min(1).max(200).optional(),
  clientOrderId: z.string().trim().min(1).max(200).optional(),
  userId: attributionUserIdSchema,
});

// ----------------------------------------------------------------- claims

export const claimBuildSchema = z.object({
  wallet: walletSchema,
  marketId: marketIdSchema,
});

// ----------------------------------------------------------------- create

/** Mirrors POST /markets/create/quote/ exactly. */
export const createMarketQuoteSchema = z
  .object({
    wallet: walletSchema,
    question: z.string().trim().min(10, "Ask a specific question").max(512),
    resolutionRule: z
      .string()
      .trim()
      .min(20, "Describe exactly how this resolves")
      .max(2048),
    sourcesOfTruth: z
      .array(z.string().trim().min(1).max(2048))
      .min(1, "Add at least one source of truth")
      .max(20),
    category: z.string().trim().min(1).max(64),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    resolutionTime: z.number().int().positive(),
    imageUrl: z
      .string()
      .trim()
      .max(2048)
      .url("Must be a public http(s) image URL")
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "Image URL must use http or https",
      }),
    marketType: z.enum(["standard", "breaking"]).optional(),
    eventInProgress: z.boolean().optional(),
    title: z.string().trim().max(512).optional(),
    description: z.string().trim().max(4096).optional(),
    region: z.string().trim().max(128).optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  })
  .refine((data) => data.endTime <= data.resolutionTime, {
    message: "Resolution time must be at or after end time",
    path: ["resolutionTime"],
  })
  .refine((data) => !data.eventInProgress || data.marketType === "breaking", {
    message: "eventInProgress is only allowed on breaking markets",
    path: ["eventInProgress"],
  });

export const createBuildSchema = z.object({
  createId: z.string().trim().min(1).max(200),
  wallet: walletSchema.optional(),
});

export const createRegisterSchema = z.object({
  createId: z.string().trim().min(1).max(200),
  signature: signatureSchema,
});

// --------------------------------------------------------------------- AI

export const marketAnalysisSchema = z.object({
  marketId: marketIdSchema,
});

// --------------------------------------------------------------- queries

export const listMarketsQuerySchema = z.object({
  category: z.string().trim().max(64).optional(),
  status: z.enum(["primary", "secondary", "resolved", "cancelled"]).optional(),
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  createdBy: z.literal("me").optional(),
});

export const walletQuerySchema = z.object({
  wallet: walletSchema,
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** Flattens a ZodError into the `fields` shape our error envelope uses. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const flat = error.flatten();
  const fields: Record<string, string[]> = { ...flat.fieldErrors } as Record<
    string,
    string[]
  >;
  if (flat.formErrors.length) fields._form = flat.formErrors;
  return fields;
}
