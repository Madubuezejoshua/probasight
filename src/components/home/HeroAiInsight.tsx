"use client";

import { useCallback, useEffect, useState } from "react";
import { readAnalysisCache, writeAnalysisCache } from "@/lib/ai/analysis-cache";
import type { MarketAnalysisResponse } from "@/lib/ai/schema";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";

/**
 * Compact AI insight line for the hero card.
 *
 * Two rules shape this component.
 *
 * It never renders sample or placeholder analysis text. Any such line would be
 * fabricated market commentary presented as a read of a real market, so when no
 * analysis exists the card says what the feature does and offers to run it.
 *
 * It never calls the model on render. Analysis is billed per call and the route
 * is rate limited, so an automatic fetch would bill every homepage view and
 * make the hero fail with 429 on a refresh. Instead it shows an analysis the
 * visitor has already generated this session, read from the cache shared with
 * the market page, and otherwise runs only on an explicit click.
 */

/** Two lines at the hero card's width, matching the `line-clamp-2` below. */
const PREVIEW_CLAMP_CHARS = 190;

function previewText(analysis: MarketAnalysisResponse): string {
  const summary = analysis.analysis.summary.trim();
  if (summary.length <= PREVIEW_CLAMP_CHARS) return summary;
  const clipped = summary.slice(0, PREVIEW_CLAMP_CHARS);
  const lastSpace = clipped.lastIndexOf(" ");
  const cut = lastSpace > 120 ? clipped.slice(0, lastSpace) : clipped;
  // Strip trailing punctuation so a clip landing after a full stop does not
  // render as "... ." or "....".
  return `${cut.replace(/[\s.,;:]+$/, "")}...`;
}

export function HeroAiInsight({ marketId }: { marketId: string }) {
  const [data, setData] = useState<MarketAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  // Reads cache after mount so server and client markup agree on first paint.
  useEffect(() => {
    setData(readAnalysisCache(marketId));
    setError(null);
  }, [marketId]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<MarketAnalysisResponse>("/api/ai/market-analysis", {
        method: "POST",
        body: { marketId },
      });
      setData(result);
      writeAnalysisCache(marketId, result);
    } catch (err) {
      setError(toErrorShape(err));
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  return (
    <section
      aria-label="AI insight"
      className="rounded-[var(--radius-chip)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
          <span aria-hidden className="text-[var(--color-accent)]">
            ◆
          </span>
          AI insight
        </h3>
        {data && !loading ? (
          <span className="tabular shrink-0 text-[10px] text-[var(--color-faint)]">
            {data.model}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-2 space-y-1.5" aria-live="polite">
          <div className="pp-skeleton h-3 w-full rounded" />
          <div className="pp-skeleton h-3 w-4/5 rounded" />
        </div>
      ) : data ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-muted)]">
          {previewText(data)}
        </p>
      ) : error ? (
        <div className="mt-1.5">
          <p className="text-xs leading-relaxed text-[var(--color-danger)]">
            {error.message}
          </p>
          {error.retryable ? (
            <button type="button" onClick={run} className="pp-btn pp-btn-ghost mt-2 text-xs">
              Try again
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-1.5">
          <p className="text-xs leading-relaxed text-[var(--color-muted)]">
            Generate a structured read of this market from its own Panta data and trade
            tape.
          </p>
          <button
            type="button"
            onClick={run}
            className="pp-btn pp-btn-secondary mt-2 h-7 px-2.5 text-xs"
          >
            Generate insight
          </button>
        </div>
      )}
    </section>
  );
}
