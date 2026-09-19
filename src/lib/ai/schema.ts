import { z } from "zod";

/**
 * Strict contract for AI Market Intelligence output.
 *
 * The model is instructed to return exactly this JSON. Anything that fails
 * this parse is never rendered as trusted structured content.
 */

const sentence = z.string().trim().min(1).max(1200);
const bullets = z.array(z.string().trim().min(1).max(600)).min(1).max(6);

export const marketAnalysisSchema = z.object({
  summary: sentence,
  currentMarketView: sentence,
  activityAnalysis: sentence,
  yesCase: bullets,
  noCase: bullets,
  keyUncertainties: bullets,
  dataLimitations: bullets,
});

export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;

export type MarketAnalysisResponse = {
  analysis: MarketAnalysis;
  /** Echoed so the UI can show exactly which Panta snapshot was analysed. */
  generatedAt: string;
  model: string;
  marketId: string;
};

/**
 * Models occasionally wrap JSON in prose or code fences despite instructions.
 * This extracts the outermost JSON object before parsing. It never repairs
 * content — it only strips wrappers.
 */
export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export type ParseResult =
  | { ok: true; value: MarketAnalysis }
  | { ok: false; reason: string };

/** Parses raw model text into a validated analysis, or explains why it failed. */
export function parseMarketAnalysis(raw: string): ParseResult {
  const json = extractJsonObject(raw);
  if (!json) return { ok: false, reason: "No JSON object found in the model response" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "Model response was not valid JSON" };
  }

  const result = marketAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return { ok: false, reason: `Response did not match the required schema (${issues})` };
  }
  return { ok: true, value: result.data };
}
