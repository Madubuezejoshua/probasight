import "server-only";

import { getPantaConfig } from "@/lib/env";
import { AppError, normalizePantaError } from "./errors";

/**
 * The single Panta HTTP client.
 *
 * Every Panta call in this application goes through here so that:
 *  - the developer API key exists only on the server,
 *  - the base URL is configured once,
 *  - Panta's trailing-slash requirement is enforced,
 *  - errors are normalised before they reach a route handler,
 *  - nothing secret is ever logged.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export type PantaRequest = {
  /** Path relative to the API base, e.g. `/markets/`. Trailing slash required by Panta. */
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Optional attribution id forwarded as X-User-Id. */
  userId?: string;
  timeoutMs?: number;
  /** Next.js fetch cache options for public read endpoints. */
  revalidate?: number | false;
  signal?: AbortSignal;
};

export type PantaResponse<T> = {
  data: T;
  status: number;
  /** Panta's rate-limit telemetry, when present. */
  rateLimit?: { limit?: string; remaining?: string; reset?: string };
};

function buildUrl(baseUrl: string, path: string, query?: PantaRequest["query"]): string {
  // Panta requires trailing slashes on every path.
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  const withSlash = normalisedPath.endsWith("/") ? normalisedPath : `${normalisedPath}/`;
  const url = new URL(`${baseUrl}${withSlash}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Diagnostic logging that can never contain a credential or a request body. */
function logUpstream(info: {
  method: string;
  path: string;
  status?: number;
  code?: string;
  ms: number;
}) {
  const parts = [
    `panta ${info.method} ${info.path}`,
    info.status !== undefined ? `status=${info.status}` : undefined,
    info.code ? `code=${info.code}` : undefined,
    `ms=${info.ms}`,
  ].filter(Boolean);

  console.log(parts.join(" "));
}

export async function pantaRequest<T>(req: PantaRequest): Promise<PantaResponse<T>> {
  const { apiKey, baseUrl } = getPantaConfig();
  if (!apiKey) {
    throw new AppError({
      code: "PANTA_NOT_CONFIGURED",
      message:
        "Panta API credentials are not configured on the server. Set PANTA_API_KEY in the environment.",
      status: 503,
      retryable: false,
    });
  }

  const method = req.method ?? "GET";
  const url = buildUrl(baseUrl, req.path, req.query);

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    Accept: "application/json",
  };
  if (req.userId?.trim()) headers["X-User-Id"] = req.userId.trim();

  let body: string | undefined;
  if (req.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (req.signal) {
    req.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      // Wallet-scoped and mutating calls must never be shared in a cache.
      ...(req.revalidate === undefined || req.revalidate === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: req.revalidate } }),
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof Error && err.name === "AbortError";
    const code = aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE";
    logUpstream({ method, path: req.path, code, ms: Date.now() - started });
    throw new AppError({
      code,
      message: aborted
        ? "The Panta API did not respond in time."
        : "Could not reach the Panta API.",
      status: 504,
      retryable: true,
    });
  }
  clearTimeout(timeout);

  const rateLimit = {
    limit: res.headers.get("x-ratelimit-limit") ?? undefined,
    remaining: res.headers.get("x-ratelimit-remaining") ?? undefined,
    reset: res.headers.get("x-ratelimit-reset") ?? undefined,
  };

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON upstream body. Never echo it back to the browser verbatim.
      if (!res.ok) {
        logUpstream({
          method,
          path: req.path,
          status: res.status,
          code: "UPSTREAM_BAD_RESPONSE",
          ms: Date.now() - started,
        });
        throw new AppError({
          code: "UPSTREAM_BAD_RESPONSE",
          message: "The Panta API returned a response we could not read.",
          status: 502,
          retryable: true,
        });
      }
    }
  }

  if (!res.ok) {
    const error = normalizePantaError(res.status, parsed);
    logUpstream({
      method,
      path: req.path,
      status: res.status,
      code: error.code,
      ms: Date.now() - started,
    });
    throw error;
  }

  logUpstream({ method, path: req.path, status: res.status, ms: Date.now() - started });
  return { data: parsed as T, status: res.status, rateLimit };
}
