"use client";

/**
 * Browser client for this application's own server routes.
 *
 * The browser never talks to Panta directly and never sees the developer API
 * key. Every call here hits /api/panta/* or /api/ai/*, which hold the key
 * server-side.
 */

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export class ApiError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly status: number;

  constructor(shape: ApiErrorShape, status: number) {
    super(shape.message);
    this.name = "ApiError";
    this.code = shape.code;
    this.details = shape.details;
    this.retryable = shape.retryable ?? false;
    this.status = status;
  }

  toShape(): ApiErrorShape {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

/** Converts any thrown value into the shape the UI error components expect. */
export function toErrorShape(err: unknown): ApiErrorShape {
  if (err instanceof ApiError) return err.toShape();
  if (err instanceof Error) {
    return {
      code: "CLIENT_ERROR",
      message: err.message || "Something went wrong.",
      retryable: true,
    };
  }
  return { code: "CLIENT_ERROR", message: "Something went wrong.", retryable: true };
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const url = new URL(path, window.location.origin);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: options.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      {
        code: "NETWORK_ERROR",
        message: "Could not reach the Panta Pulse server. Check your connection.",
        retryable: true,
      },
      0,
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const envelope = (parsed as { error?: ApiErrorShape } | null)?.error;
    throw new ApiError(
      envelope ?? {
        code: "INTERNAL_ERROR",
        message: `Request failed (${res.status}).`,
        retryable: res.status >= 500,
      },
      res.status,
    );
  }

  return parsed as T;
}
