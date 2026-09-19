import "server-only";

import { getGroqConfig } from "@/lib/env";
import { AppError } from "@/lib/panta/errors";
import type { MarketContext } from "./market-context";
import { SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from "./prompts";
import { parseMarketAnalysis, type MarketAnalysis } from "./schema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 45_000;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type GroqChoice = { message?: { content?: string } };
type GroqResponse = { choices?: GroqChoice[] };

async function callGroq(messages: ChatMessage[], model: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 2000,
        // Groq supports OpenAI-style JSON mode on its instruct models.
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new AppError({
      code: "AI_UNAVAILABLE",
      message: aborted
        ? "The AI service did not respond in time."
        : "Could not reach the AI service.",
      status: 504,
      retryable: true,
    });
  }
  clearTimeout(timeout);

  if (res.status === 429) {
    throw new AppError({
      code: "AI_RATE_LIMITED",
      message: "The AI provider rate limit was reached. Try again shortly.",
      status: 429,
      retryable: true,
    });
  }

  if (!res.ok) {
    // Groq error bodies can echo request context; never forward them verbatim.
    const status = res.status;

    console.error(`groq error status=${status}`);
    throw new AppError({
      code: status === 401 ? "GROQ_NOT_CONFIGURED" : "AI_UNAVAILABLE",
      message:
        status === 401
          ? "The configured GROQ_API_KEY was rejected."
          : "The AI service returned an error.",
      status: status === 401 ? 503 : 502,
      retryable: status !== 401,
    });
  }

  const body = (await res.json()) as GroqResponse;
  const content = body?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new AppError({
      code: "AI_INVALID_OUTPUT",
      message: "The AI service returned an empty response.",
      status: 502,
      retryable: true,
    });
  }
  return content;
}

/**
 * Runs the analysis, validating the structured output.
 * On a schema failure it retries exactly once with a repair instruction; a
 * second failure surfaces as an error rather than rendering malformed text.
 */
export async function analyseMarket(context: MarketContext): Promise<{
  analysis: MarketAnalysis;
  model: string;
}> {
  const { apiKey, model } = getGroqConfig();
  if (!apiKey) {
    throw new AppError({
      code: "GROQ_NOT_CONFIGURED",
      message:
        "AI analysis is not configured on the server. Set GROQ_API_KEY in the environment.",
      status: 503,
      retryable: false,
    });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(context) },
  ];

  const first = await callGroq(messages, model, apiKey);
  const parsed = parseMarketAnalysis(first);
  if (parsed.ok) return { analysis: parsed.value, model };


  console.warn(`ai schema miss, repairing: ${parsed.reason}`);

  const repaired = await callGroq(
    [
      ...messages,
      { role: "assistant", content: first.slice(0, 4000) },
      { role: "user", content: buildRepairPrompt(parsed.reason) },
    ],
    model,
    apiKey,
  );

  const second = parseMarketAnalysis(repaired);
  if (second.ok) return { analysis: second.value, model };

  throw new AppError({
    code: "AI_INVALID_OUTPUT",
    message:
      "The AI returned a response that did not match the required structure, twice. No analysis is shown rather than partial or malformed output.",
    details: { reason: second.reason },
    status: 502,
    retryable: true,
  });
}
