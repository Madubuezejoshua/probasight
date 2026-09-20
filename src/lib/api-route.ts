import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";
import { AppError, toAppError } from "@/lib/panta/errors";
import { zodFieldErrors } from "@/lib/validation/schemas";

/**
 * Shared plumbing for every route handler: one error envelope, Zod validation,
 * and a guarantee that no upstream credential can leak into a response body.
 */

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
};

/**
 * The single exit point for a failed route.
 *
 * Server-side failures are logged here with their code and status so they are
 * diagnosable, while the browser only ever receives the normalised envelope,
 * never a stack trace and never anything that could contain a credential.
 */
export function errorResponse(err: unknown): NextResponse<ErrorEnvelope> {
  const appError = toAppError(err);
  if (appError.status >= 500) {
    console.error(`route error code=${appError.code} status=${appError.status}`);
  }
  return NextResponse.json<ErrorEnvelope>(
    {
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        retryable: appError.retryable,
      },
    },
    { status: appError.status || 500 },
  );
}

export function okResponse<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json<T>(data, init);
}

/** Parses and validates a JSON body, throwing a structured AppError on failure. */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Request body must be valid JSON.",
      status: 400,
      retryable: false,
    });
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Some submitted values were not valid.",
      details: { fields: zodFieldErrors(result.error) },
      status: 400,
      retryable: false,
    });
  }
  return result.data;
}

/** Validates search params against a schema. */
export function parseQuery<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): z.infer<S> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Some query parameters were not valid.",
      details: { fields: zodFieldErrors(result.error) },
      status: 400,
      retryable: false,
    });
  }
  return result.data;
}
