import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retry semantics for the Panta client.
 *
 * Panta's production API intermittently answers a valid request with a bare
 * `400 {"code":"INVALID_MARKET_PARAMS"}` and succeeds on the next identical
 * call. Measured during the audit: `GET /markets/{id}/` succeeded 6/8 raw, and
 * `GET /trades/{sig}/` alternated roughly half the time.
 *
 * The rules under test:
 *  - GET retries that transient shape, because GET is idempotent.
 *  - POST never retries it, because quote/build mint sessions and
 *    submit/report/register must never fire twice for one signature.
 *  - A params error carrying field detail is a real validation failure and is
 *    never retried, whatever the method.
 */

const ORIGINAL_ENV = { ...process.env };

/**
 * Builds a FRESH Response each call. A Response body may only be read once, so
 * a shared instance would make the second retry throw "Body is unusable" —
 * an artefact of mocking, not of the client.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Bare transient shape: no field, no fields, no message. */
const TRANSIENT = () => jsonResponse(400, { code: "INVALID_MARKET_PARAMS" });
const OK = () => jsonResponse(200, { ok: true });

let pantaRequest: typeof import("@/lib/panta/client").pantaRequest;

beforeEach(async () => {
  vi.resetModules();
  process.env.PANTA_API_KEY = "pk_test_unit";
  process.env.PANTA_API_BASE_URL = "https://example.invalid/api/v1";
  ({ pantaRequest } = await import("@/lib/panta/client"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("GET retries the transient upstream shape", () => {
  it("recovers when the first attempt is transient and the second succeeds", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => TRANSIENT())
      .mockImplementationOnce(async () => OK());
    vi.stubGlobal("fetch", fetchMock);

    const result = await pantaRequest<{ ok: boolean }>({ path: "/markets/abc/" });
    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers on the third attempt", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => TRANSIENT())
      .mockImplementationOnce(async () => TRANSIENT())
      .mockImplementationOnce(async () => OK());
    vi.stubGlobal("fetch", fetchMock);

    const result = await pantaRequest<{ ok: boolean }>({ path: "/markets/abc/" });
    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after a bounded number of attempts rather than looping", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => TRANSIENT());
    vi.stubGlobal("fetch", fetchMock);

    await expect(pantaRequest({ path: "/markets/abc/" })).rejects.toMatchObject({
      code: "UPSTREAM_TRANSIENT",
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("POST is never auto-retried", () => {
  it("surfaces the transient error after exactly one attempt", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => TRANSIENT());
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      pantaRequest({ path: "/primaryorderquote/", method: "POST", body: {} }),
    ).rejects.toMatchObject({ code: "UPSTREAM_TRANSIENT" });

    // Retrying a quote would mint a duplicate session; a submit would risk
    // double-reporting a signature. The person decides instead.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("real validation failures are never retried", () => {
  it("does not retry a params error that names a field", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(400, {
          code: "INVALID_MARKET_PARAMS",
          message: "limit must be an integer",
          field: "limit",
        }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(pantaRequest({ path: "/markets/" })).rejects.toMatchObject({
      code: "INVALID_MARKET_PARAMS",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a documented business-rule refusal", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(400, { code: "NOT_CLAIMABLE" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(pantaRequest({ path: "/markets/abc/" })).rejects.toMatchObject({
      code: "NOT_CLAIMABLE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an auth failure", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(401, { code: "UNAUTHORIZED" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(pantaRequest({ path: "/markets/" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("credential guard", () => {
  it("fails closed when no API key is configured", async () => {
    vi.resetModules();
    delete process.env.PANTA_API_KEY;
    const mod = await import("@/lib/panta/client");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(mod.pantaRequest({ path: "/markets/" })).rejects.toMatchObject({
      code: "PANTA_NOT_CONFIGURED",
    });
    // Must never reach the network without a credential.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
