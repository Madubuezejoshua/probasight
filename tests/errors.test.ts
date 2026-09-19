import { describe, expect, it } from "vitest";
import {
  AppError,
  REBUILD_CODES,
  messageForCode,
  normalizePantaError,
  toAppError,
} from "@/lib/panta/errors";

describe("normalizePantaError", () => {
  it("preserves the documented Panta code verbatim", () => {
    const error = normalizePantaError(400, {
      code: "QUOTE_STALE",
      message: "curve moved",
    });
    expect(error.code).toBe("QUOTE_STALE");
    expect(error.status).toBe(400);
  });

  it("maps codes to user-facing copy instead of leaking upstream wording", () => {
    const error = normalizePantaError(400, { code: "MARKET_NOT_IN_PRIMARY" });
    expect(error.message).toBe("This market is not currently accepting primary buys.");
  });

  it("keeps field-level validation detail for the form to render", () => {
    const error = normalizePantaError(400, {
      code: "INVALID_MARKET_PARAMS",
      message: "imageUrl: This field is required.",
      fields: { imageUrl: ["This field is required."] },
    });
    expect(error.details?.fields).toEqual({ imageUrl: ["This field is required."] });
    expect(error.details?.upstreamMessage).toBe("imageUrl: This field is required.");
  });

  it("derives a code from the HTTP status when the body has none", () => {
    expect(normalizePantaError(401, {}).code).toBe("UNAUTHORIZED");
    expect(normalizePantaError(403, {}).code).toBe("FORBIDDEN");
    expect(normalizePantaError(404, {}).code).toBe("MARKET_NOT_FOUND");
    expect(normalizePantaError(429, {}).code).toBe("RATE_LIMITED");
    expect(normalizePantaError(500, {}).code).toBe("INTERNAL_ERROR");
  });

  it("treats a wholly empty 400 as transient, not as a user input error", () => {
    // A 400 with no code and no detail carries no evidence that the caller did
    // anything wrong, and matches the shape of the upstream flakiness below.
    // Blaming the user's input for it would be a guess.
    const error = normalizePantaError(400, {});
    expect(error.code).toBe("UPSTREAM_TRANSIENT");
    expect(error.retryable).toBe(true);
  });

  it("marks transient failures retryable and permanent ones not", () => {
    expect(normalizePantaError(429, { code: "RATE_LIMITED" }).retryable).toBe(true);
    expect(normalizePantaError(503, { code: "INTERNAL_ERROR" }).retryable).toBe(true);
    expect(normalizePantaError(404, { code: "TX_NOT_FOUND" }).retryable).toBe(true);
    expect(normalizePantaError(400, { code: "NOT_CLAIMABLE" }).retryable).toBe(false);
    expect(normalizePantaError(401, { code: "UNAUTHORIZED" }).retryable).toBe(false);
  });

  it("tolerates a null or non-object upstream body", () => {
    expect(() => normalizePantaError(500, null)).not.toThrow();
    expect(normalizePantaError(500, null).code).toBe("INTERNAL_ERROR");
  });
});

describe("rebuild codes", () => {
  it("identifies the failures that require a fresh quote or build", () => {
    // These must never be retried against stale transaction data.
    expect(REBUILD_CODES.has("QUOTE_EXPIRED")).toBe(true);
    expect(REBUILD_CODES.has("QUOTE_STALE")).toBe(true);
    expect(REBUILD_CODES.has("CREATE_EXPIRED")).toBe(true);
    expect(REBUILD_CODES.has("BLOCKHASH_EXPIRED")).toBe(true);
    expect(REBUILD_CODES.has("RATE_LIMITED")).toBe(false);
  });
});

describe("messageForCode", () => {
  it("falls back to the upstream message for unknown codes", () => {
    expect(messageForCode("SOME_NEW_CODE", "upstream detail")).toBe("upstream detail");
  });

  it("has copy for every code the docs list", () => {
    const documented = [
      "UNAUTHORIZED",
      "CREATE_NOT_PERMITTED",
      "FORBIDDEN",
      "INVALID_MARKET_PARAMS",
      "DUPLICATE_MARKET",
      "CREATE_EXPIRED",
      "QUOTE_EXPIRED",
      "QUOTE_STALE",
      "AMOUNT_TOO_SMALL",
      "MARKET_NOT_FOUND",
      "MARKET_NOT_IN_PRIMARY",
      "NOT_CLAIMABLE",
      "NOT_MARKET_CREATOR",
      "MARKET_NOT_GRADUATED",
      "NO_CREATOR_FEES",
      "UPLOAD_NOT_CONFIGURED",
      "TX_NOT_FOUND",
      "TX_FAILED",
      "TX_MISMATCH",
      "TX_FEE_MISMATCH",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
    ];
    for (const code of documented) {
      expect(messageForCode(code), `missing copy for ${code}`).not.toBe(
        "Something went wrong.",
      );
    }
  });
});

describe("toAppError", () => {
  it("passes an AppError through unchanged", () => {
    const original = new AppError({ code: "TX_FAILED", message: "nope", status: 400 });
    expect(toAppError(original)).toBe(original);
  });

  it("wraps plain errors and unknown throws", () => {
    expect(toAppError(new Error("boom")).message).toBe("boom");
    expect(toAppError("string throw").code).toBe("INTERNAL_ERROR");
  });

  it("serialises without exposing internals", () => {
    const json = new AppError({
      code: "RATE_LIMITED",
      message: "slow down",
      status: 429,
    }).toJSON();
    expect(json).toEqual({
      code: "RATE_LIMITED",
      message: "slow down",
      details: undefined,
      retryable: true,
    });
  });
});

/**
 * Panta intermittently returns a BARE `INVALID_MARKET_PARAMS` for requests that
 * succeed moments later. Reproduced against production: the identical
 * trade-status request alternated 200 / 400 across eight consecutive calls,
 * with the 400 body being exactly `{"code":"INVALID_MARKET_PARAMS"}`.
 *
 * Genuine validation failures always carry `field`, `fields` or `message`. The
 * distinction is what separates "your input is wrong" (do not retry) from
 * "upstream hiccuped" (retry).
 */
describe("detail-less INVALID_MARKET_PARAMS is treated as transient", () => {
  it("reclassifies a bare params error as retryable upstream noise", () => {
    const error = normalizePantaError(400, { code: "INVALID_MARKET_PARAMS" });
    expect(error.code).toBe("UPSTREAM_TRANSIENT");
    expect(error.retryable).toBe(true);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/nothing is wrong with your input/i);
  });

  it("keeps a params error with a field as a hard validation failure", () => {
    const error = normalizePantaError(400, {
      code: "INVALID_MARKET_PARAMS",
      message: "limit must be an integer",
      field: "limit",
    });
    expect(error.code).toBe("INVALID_MARKET_PARAMS");
    expect(error.retryable).toBe(false);
    expect(error.status).toBe(400);
    expect(error.details?.field).toBe("limit");
  });

  it("keeps a params error with fields as a hard validation failure", () => {
    const error = normalizePantaError(400, {
      code: "INVALID_MARKET_PARAMS",
      fields: { imageUrl: ["This field is required."] },
    });
    expect(error.code).toBe("INVALID_MARKET_PARAMS");
    expect(error.retryable).toBe(false);
    expect(error.details?.fields).toEqual({ imageUrl: ["This field is required."] });
  });

  it("keeps a params error with only a message as a hard validation failure", () => {
    const error = normalizePantaError(400, {
      code: "INVALID_MARKET_PARAMS",
      message: "startTime must be at least 3600s ahead of now",
    });
    expect(error.code).toBe("INVALID_MARKET_PARAMS");
    expect(error.retryable).toBe(false);
  });

  it("does not reclassify other bare codes", () => {
    expect(normalizePantaError(400, { code: "NOT_CLAIMABLE" }).code).toBe("NOT_CLAIMABLE");
    expect(normalizePantaError(400, { code: "MARKET_NOT_IN_PRIMARY" }).retryable).toBe(false);
  });
});
