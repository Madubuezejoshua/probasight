import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PantaMarket } from "@/lib/panta/types";

/**
 * Re-fetch semantics for a question-less market detail row.
 *
 * Panta's market detail endpoint intermittently answers HTTP 200 with both
 * `title` and `description` empty for a market that genuinely has a question.
 * Observed during the rebrand pass: four consecutive POSTs for the SAME
 * marketId returned 422, 422, 200, 200.
 *
 * Because that response is a 200 rather than an error code, the transient
 * retry in `lib/panta/client` does not fire, so the AI route re-fetches for
 * itself before refusing.
 *
 * The rules under test:
 *  - A populated first response is used immediately, with no extra call.
 *  - An empty first response is re-fetched, and a later populated response wins.
 *  - A genuinely question-less market is still REFUSED after the attempts are
 *    exhausted. The honest-refusal guard is not weakened by the retry.
 */

const MARKET_ID = "AESrMoZxcTGQibC1rNEmq3oz9qoDqHhomUe6MQEw1k9F";

function market(overrides: Partial<PantaMarket> = {}): PantaMarket {
  return {
    marketId: MARKET_ID,
    category: "sports",
    title: "",
    description: "",
    phase: "primary",
    ...overrides,
  } as PantaMarket;
}

const WITH_QUESTION = () =>
  market({ title: "Will the Fed cut rates at the March meeting?" });
const EMPTY = () => market();

const getMarket = vi.fn();
const getMarketTrades = vi.fn();
const analyseMarket = vi.fn();

vi.mock("@/lib/panta/markets", () => ({
  getMarket: (...args: unknown[]) => getMarket(...args),
  getMarketTrades: (...args: unknown[]) => getMarketTrades(...args),
}));

vi.mock("@/lib/ai/groq", () => ({
  analyseMarket: (...args: unknown[]) => analyseMarket(...args),
}));

let POST: typeof import("@/app/api/ai/market-analysis/route").POST;

function request(): Request {
  return new Request("http://localhost/api/ai/market-analysis", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${counter++}` },
    body: JSON.stringify({ marketId: MARKET_ID }),
  });
}

// The route rate-limits per client key, so each test uses a distinct caller.
let counter = 1;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  getMarket.mockReset();
  getMarketTrades.mockReset().mockResolvedValue({ marketId: MARKET_ID, items: [] });
  analyseMarket.mockReset().mockResolvedValue({
    analysis: { summary: "stub" },
    model: "test-model",
  });
  ({ POST } = await import("@/app/api/ai/market-analysis/route"));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Drives the route to completion while fake timers cover the backoff sleeps. */
async function run(): Promise<Response> {
  const pending = POST(request());
  await vi.runAllTimersAsync();
  return pending;
}

describe("AI route re-fetches a question-less market detail row", () => {
  it("uses a populated first response without re-fetching", async () => {
    getMarket.mockResolvedValue(WITH_QUESTION());

    const response = await run();

    expect(response.status).toBe(200);
    expect(getMarket).toHaveBeenCalledTimes(1);
  });

  it("recovers when the question arrives on a later attempt", async () => {
    getMarket
      .mockResolvedValueOnce(EMPTY())
      .mockResolvedValueOnce(WITH_QUESTION());

    const response = await run();

    expect(response.status).toBe(200);
    expect(getMarket).toHaveBeenCalledTimes(2);
    // The model must receive the populated row, never the empty one.
    expect(analyseMarket).toHaveBeenCalledTimes(1);
  });

  it("still refuses a genuinely question-less market after exhausting attempts", async () => {
    getMarket.mockResolvedValue(EMPTY());

    const response = await run();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("MARKET_QUESTION_UNAVAILABLE");
    // Refused, not analysed: the guard is intact.
    expect(analyseMarket).not.toHaveBeenCalled();
  });

  it("bounds the number of attempts rather than looping", async () => {
    getMarket.mockResolvedValue(EMPTY());

    await run();

    expect(getMarket).toHaveBeenCalledTimes(3);
  });
});
