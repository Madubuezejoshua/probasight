/**
 * Normalised application error shape shared by server routes and the UI.
 *
 * Panta returns `{ code, message, field?, fields? }` (see docs /guides/errors).
 * We preserve `code` verbatim so the UI can switch on documented values, and
 * add `retryable` so components can decide whether to offer a retry button.
 */

export type AppErrorShape = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
  status?: number;
};

/** Documented Panta codes plus our own transport/app codes. */
export const RETRYABLE_CODES = new Set([
  "RATE_LIMITED",
  "UPSTREAM_TRANSIENT",
  "INTERNAL_ERROR",
  "UPSTREAM_UNREACHABLE",
  "UPSTREAM_TIMEOUT",
  "TX_NOT_FOUND",
  "RPC_TIMEOUT",
]);

/** Codes where the right recovery is to re-run the quote/build step. */
export const REBUILD_CODES = new Set([
  "QUOTE_EXPIRED",
  "QUOTE_STALE",
  "CREATE_EXPIRED",
  "BLOCKHASH_EXPIRED",
]);

export class AppError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly status: number;

  constructor(shape: AppErrorShape) {
    super(shape.message);
    this.name = "AppError";
    this.code = shape.code;
    this.details = shape.details;
    this.status = shape.status ?? 500;
    this.retryable = shape.retryable ?? RETRYABLE_CODES.has(shape.code);
  }

  toJSON(): AppErrorShape {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

/**
 * Human copy for every documented Panta error code plus our transport codes.
 * Anything unmapped falls back to the upstream message, which is already
 * user-facing in Panta's envelope.
 */
const MESSAGES: Record<string, string> = {
  UNAUTHORIZED:
    "Panta rejected this application's API credentials. The server key is missing, invalid or revoked.",
  CREATE_NOT_PERMITTED:
    "This Panta account is not permitted to create markets. Ask Panta to enable create access for the key.",
  FORBIDDEN: "Panta refused this operation for the current credentials.",
  INVALID_MARKET_PARAMS: "Some of the submitted values were rejected by Panta.",
  DUPLICATE_MARKET:
    "A market with this exact question already exists for this creator wallet. Change the question.",
  CREATE_EXPIRED:
    "The market-creation session expired. Re-run the creation quote to start a fresh session.",
  QUOTE_EXPIRED: "The quote expired. Request a new quote before trading.",
  QUOTE_STALE:
    "The bonding curve moved beyond your slippage tolerance. Request a new quote.",
  AMOUNT_TOO_SMALL: "That amount is below Panta's minimum fill size for this market.",
  MARKET_NOT_FOUND: "Panta could not find this market.",
  MARKET_NOT_IN_PRIMARY: "This market is not currently accepting primary buys.",
  NOT_CLAIMABLE: "Panta reports this position is not claimable yet.",
  NOT_MARKET_CREATOR: "This wallet is not the creator of that market.",
  MARKET_NOT_GRADUATED: "Creator fees are not claimable until the market graduates.",
  NO_CREATOR_FEES: "There are no accumulated creator fees to claim on this market.",
  UPLOAD_NOT_CONFIGURED: "Panta's image upload service is unavailable right now.",
  TX_NOT_FOUND:
    "Panta has not observed this transaction yet. It may still be propagating. Retry shortly.",
  TX_FAILED: "The transaction failed on-chain.",
  TX_MISMATCH:
    "The transaction does not match the expected wallet, market or program for this action.",
  TX_FEE_MISMATCH: "The on-chain amount does not match the quoted amount.",
  RATE_LIMITED: "Panta rate limit reached. Wait a moment and try again.",
  UPSTREAM_TRANSIENT:
    "Panta rejected that request without saying why, which it does intermittently under load. Nothing is wrong with your input. Try again.",
  INTERNAL_ERROR: "Panta returned an internal error.",
  // Our own codes
  PANTA_NOT_CONFIGURED:
    "Panta API credentials are not configured on the server. Set PANTA_API_KEY.",
  GROQ_NOT_CONFIGURED:
    "AI analysis is not configured on the server. Set GROQ_API_KEY.",
  UPSTREAM_UNREACHABLE: "Could not reach the Panta API.",
  UPSTREAM_TIMEOUT: "The Panta API did not respond in time.",
  UPSTREAM_BAD_RESPONSE: "The Panta API returned a response we could not read.",
  VALIDATION_FAILED: "The request was not valid.",
  METHOD_NOT_ALLOWED: "Unsupported request method.",
  WALLET_NOT_CONNECTED: "Connect a Solana wallet first.",
  WALLET_REJECTED: "You declined the signature request in your wallet.",
  WALLET_CANNOT_SIGN: "This wallet cannot sign transactions in the browser.",
  BLOCKHASH_EXPIRED:
    "The transaction's blockhash expired before it was signed. Rebuilding is required.",
  RPC_TIMEOUT: "The Solana RPC did not confirm the transaction in time.",
  RPC_REJECTED: "The Solana RPC rejected the transaction.",
  TX_REVERTED: "The transaction was processed but failed on-chain.",
  AI_INVALID_OUTPUT: "The AI returned a response that did not match the expected structure.",
  MARKET_QUESTION_UNAVAILABLE:
    "This market has no question text in Panta's catalog, so there is nothing to analyse. Inferring what it asks would be fabrication.",
  AI_UNAVAILABLE: "The AI service is unavailable right now.",
  AI_RATE_LIMITED: "Too many AI analysis requests. Wait a moment and try again.",
};

export function messageForCode(code: string, fallback?: string): string {
  return MESSAGES[code] ?? fallback ?? "Something went wrong.";
}

type UpstreamBody = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  field?: unknown;
  fields?: unknown;
};

/**
 * Convert an upstream Panta HTTP failure into an AppError.
 * Never includes credentials or raw request bodies.
 */
export function normalizePantaError(status: number, body: unknown): AppError {
  const parsed = (body ?? {}) as UpstreamBody;
  const code =
    typeof parsed.code === "string" && parsed.code
      ? parsed.code
      : statusFallbackCode(status);

  const upstreamMessage =
    (typeof parsed.message === "string" && parsed.message) ||
    (typeof parsed.detail === "string" && parsed.detail) ||
    undefined;

  const details: Record<string, unknown> = {};
  if (parsed.field) details.field = parsed.field;
  if (parsed.fields && typeof parsed.fields === "object") details.fields = parsed.fields;
  if (upstreamMessage) details.upstreamMessage = upstreamMessage;

  /**
   * A bare INVALID_MARKET_PARAMS is an upstream fault, not a validation error.
   *
   * Verified against production: the identical request alternates between 200
   * and `400 {"code":"INVALID_MARKET_PARAMS"}` with no `field`, no `fields`
   * and no `message`. Every genuine Panta validation failure carries detail,
   * `{"message":"limit must be an integer","field":"limit"}` or
   * `{"fields":{"imageUrl":[...]}}`. Treating the detail-less form as a hard
   * user error told people their input was rejected when nothing was wrong
   * with it, and denied them a retry. It is surfaced as transient instead.
   */
  const isDetaillessParamsError =
    code === "INVALID_MARKET_PARAMS" && Object.keys(details).length === 0;

  return new AppError({
    code: isDetaillessParamsError ? "UPSTREAM_TRANSIENT" : code,
    message: isDetaillessParamsError
      ? messageForCode("UPSTREAM_TRANSIENT")
      : messageForCode(code, upstreamMessage),
    details: Object.keys(details).length ? details : undefined,
    status: isDetaillessParamsError ? 502 : status,
    retryable:
      isDetaillessParamsError ||
      RETRYABLE_CODES.has(code) ||
      status === 429 ||
      status >= 500,
  });
}

function statusFallbackCode(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "MARKET_NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "INVALID_MARKET_PARAMS";
}

/** Coerce anything thrown into a serialisable AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError({
      code: "INTERNAL_ERROR",
      message: err.message || "Unexpected error",
      status: 500,
    });
  }
  return new AppError({ code: "INTERNAL_ERROR", message: "Unexpected error", status: 500 });
}
