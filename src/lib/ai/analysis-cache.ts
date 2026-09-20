import type { MarketAnalysisResponse } from "@/lib/ai/schema";

/**
 * Per-market analysis cache, shared by every surface that shows AI output.
 *
 * Analysis runs only on an explicit user action and is billed per call, so a
 * result is kept for the rest of the browser session and reused rather than
 * regenerated. Extracted from `MarketIntelligence` so the homepage hero card
 * can show an analysis the visitor has ALREADY generated instead of either
 * re-billing the model or inventing preview text.
 *
 * sessionStorage only: nothing is persisted server-side, there is no database,
 * and the cache never leaves the visitor's own browser tab. Every access is
 * guarded because storage can be disabled, full, or throw in private mode.
 */
const CACHE_PREFIX = "pp:analysis:";

export function readAnalysisCache(marketId: string): MarketAnalysisResponse | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + marketId);
    return raw ? (JSON.parse(raw) as MarketAnalysisResponse) : null;
  } catch {
    return null;
  }
}

export function writeAnalysisCache(marketId: string, value: MarketAnalysisResponse) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + marketId, JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full; the analysis still renders.
  }
}
