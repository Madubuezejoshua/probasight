"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import type { MarketAnalysisResponse } from "@/lib/ai/schema";
import { ErrorState, Skeleton, Spinner } from "@/components/common/States";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { readAnalysisCache, writeAnalysisCache } from "@/lib/ai/analysis-cache";

/**
 * AI Market Intelligence.
 *
 * Runs only on an explicit user action, never on render. The result is cached
 * per market by `lib/ai/analysis-cache` so navigating back does not re-bill the
 * model; there is no database and nothing is persisted server-side.
 */

export function MarketIntelligence({
  marketId,
  analysable = true,
}: {
  marketId: string;
  /** False when Panta has no question text for this market. */
  analysable?: boolean;
}) {
  const [data, setData] = useState<MarketAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

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
    <section className="pp-card overflow-hidden" aria-labelledby="ai-intel-heading">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] p-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)]/45 text-xs text-[var(--color-accent)]"
          >
            ◆
          </span>
          <div>
            <h2 id="ai-intel-heading" className="text-sm font-semibold text-[var(--color-text)]">
              AI Market Intelligence
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Generated from this market&apos;s live Panta data only
            </p>
          </div>
        </div>

        {analysable && data && !loading && (
          <button type="button" onClick={() => void run()} className="pp-btn pp-btn-secondary">
            Regenerate
          </button>
        )}
      </header>

      <div className="p-4">
        {!analysable ? (
          /* Nothing truthful can be said about a market with no question. */
          <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] px-5 py-8 text-center">
            <p className="text-sm font-medium text-[var(--color-text)]">
              No question text for this market
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[var(--color-muted)]">
              Panta&apos;s catalog returns an empty title and description for this market, so
              there is nothing to analyse. Inferring what it asks from its category or oracle
              feeds would be fabrication, so no analysis is offered.
            </p>
          </div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="space-y-3">
            <ErrorState error={error} onRetry={() => void run()} compact />
            {error.code === "GROQ_NOT_CONFIGURED" && (
              <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                Set <code className="font-mono text-[var(--color-text)]">GROQ_API_KEY</code> on
                the server to enable analysis. Every other part of this page works without it.
              </p>
            )}
          </div>
        ) : data ? (
          <AnalysisView data={data} />
        ) : (
          <div className="py-6 text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
              Generate a structured, balanced read of this market from its Panta catalog
              data, current pricing, timing, resolution metadata and recent trade tape.
            </p>
            <button type="button" onClick={() => void run()} className="pp-btn pp-btn-primary mt-4">
              Analyze with AI
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Spinner className="text-[var(--color-accent)]" />
        Analysing the Panta snapshot…
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

function AnalysisView({ data }: { data: MarketAnalysisResponse }) {
  const { analysis } = data;
  return (
    // The model quotes on-chain identifiers verbatim, e.g. a 44-character base58
    // oracle address. With no break opportunity inside it, that one token set the
    // minimum width of its grid column and pushed the YES/NO cards ~100px past a
    // 360px screen, where the card's overflow-hidden clipped them.
    // `overflow-wrap: anywhere` is inherited by every block below and, unlike
    // `break-word`, also shrinks min-content width, so the grids can fit.
    <div className="pp-fade min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <Block title="Summary">
        <p className="text-sm leading-relaxed text-[var(--color-text)]">{analysis.summary}</p>
      </Block>

      <div className="grid gap-4 sm:grid-cols-2">
        <Block title="Current market view">
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">
            {analysis.currentMarketView}
          </p>
        </Block>
        <Block title="Activity analysis">
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">
            {analysis.activityAnalysis}
          </p>
        </Block>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CaseCard tone="yes" title="YES case" items={analysis.yesCase} />
        <CaseCard tone="no" title="NO case" items={analysis.noCase} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Block title="Key uncertainties">
          <BulletList items={analysis.keyUncertainties} marker="?" />
        </Block>
        <Block title="Data limitations">
          <BulletList items={analysis.dataLimitations} marker="!" muted />
        </Block>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-3">
        <p className="text-[11px] leading-relaxed text-[var(--color-faint)]">
          AI analysis is informational and may be incomplete. Verify market rules before
          trading. Not financial advice.
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[var(--color-faint)]">{data.model}</span>
          <PoweredByPanta variant="subtle" />
        </div>
      </footer>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CaseCard({
  tone,
  title,
  items,
}: {
  tone: "yes" | "no";
  title: string;
  items: string[];
}) {
  const isYes = tone === "yes";
  return (
    <div
      className={`min-w-0 rounded-[var(--radius-control)] border p-3.5 ${
        isYes
          ? "border-[var(--color-yes)]/25 bg-[var(--color-yes-dim)]/30"
          : "border-[var(--color-no)]/25 bg-[var(--color-no-dim)]/30"
      }`}
    >
      <h3
        className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${
          isYes ? "text-[var(--color-yes)]" : "text-[var(--color-no)]"
        }`}
      >
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm leading-relaxed text-[var(--color-text)]">
            <span
              aria-hidden
              className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${
                isYes ? "bg-[var(--color-yes)]" : "bg-[var(--color-no)]"
              }`}
            />
            <span className="min-w-0 flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulletList({
  items,
  marker,
  muted = false,
}: {
  items: string[];
  marker: string;
  muted?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li
          key={index}
          className={`flex gap-2 text-sm leading-relaxed ${
            muted ? "text-[var(--color-faint)]" : "text-[var(--color-muted)]"
          }`}
        >
          <span aria-hidden className="mt-0.5 shrink-0 font-mono text-[10px] opacity-60">
            {marker}
          </span>
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
