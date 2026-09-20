"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import type { PantaMarket, PantaMarketsList } from "@/lib/panta/types";
import { marketTitle } from "@/lib/panta/display";
import { MarketCard } from "./MarketCard";
import { EmptyState, ErrorState, MarketGridSkeleton, Spinner } from "@/components/common/States";
import { cn } from "@/lib/utils/cn";

const PAGE_SIZE = 24;

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "resolved", label: "Resolved" },
  { value: "cancelled", label: "Cancelled" },
] as const;

/**
 * Market discovery.
 *
 * Category filters server-side via Panta's documented `category` parameter,
 * which works correctly. Phase and text both filter client-side: Panta's list
 * endpoint has no text-search parameter, and its `status` parameter does not
 * filter by phase reliably (see `load`). Both are labelled in the UI as
 * operating on the loaded set rather than the whole catalog.
 */
export function MarketsExplorer({
  initialMarkets,
  initialCursor,
  categories,
  initialError,
}: {
  initialMarkets: PantaMarket[];
  initialCursor: string | null;
  categories: string[];
  initialError: ApiErrorShape | null;
}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  // Categories are fetched server-side. If that failed, the filter row would be
  // permanently empty with no way back, so keep them in state and allow a
  // client-side retry through our own categories route.
  const [categoryList, setCategoryList] = useState<string[]>(categories);
  const [reloadingCategories, setReloadingCategories] = useState(false);

  const [markets, setMarkets] = useState<PantaMarket[]>(initialMarkets);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [deferredQuery, setDeferredQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(initialError);

  const requestId = useRef(0);

  const reloadCategories = useCallback(async () => {
    setReloadingCategories(true);
    try {
      const result = await apiFetch<{ categories: string[] }>("/api/panta/categories");
      setCategoryList(result.categories ?? []);
    } catch {
      // Leave the row as-is; the retry affordance stays available.
    } finally {
      setReloadingCategories(false);
    }
  }, []);

  // Debounce the text filter so typing does not thrash rendering.
  useEffect(() => {
    const timer = setTimeout(() => setDeferredQuery(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Loads a page of the catalog.
   *
   * Only `category` is sent upstream. Panta's `status` parameter is documented
   * as a phase filter but does not behave as one against the live catalog:
   * `status=primary` returns a mix of cancelled, resolved and secondary rows,
   * and `status=resolved` returns nothing at all while resolved markets exist.
   * Sending it would produce visibly wrong results, so phase is filtered
   * client-side on each row's actual `phase` field instead, see `visible`.
   */
  const load = useCallback(async (nextCategory: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<PantaMarketsList>("/api/panta/markets", {
        query: { category: nextCategory || undefined, limit: PAGE_SIZE },
      });
      if (id !== requestId.current) return;
      setMarkets(result.items);
      setCursor(result.nextCursor ?? null);
      setExhausted(false);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(toErrorShape(err));
      setMarkets([]);
      setCursor(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await apiFetch<PantaMarketsList>("/api/panta/markets", {
        query: { category: category || undefined, cursor, limit: PAGE_SIZE },
      });

      let added = 0;
      setMarkets((current) => {
        const seen = new Set(current.map((m) => m.marketId));
        const fresh = result.items.filter((m) => !seen.has(m.marketId));
        added = fresh.length;
        return fresh.length ? [...current, ...fresh] : current;
      });

      // Panta's cursor currently returns the same page rather than advancing.
      // Rather than leave a button that silently does nothing, treat a page
      // with no new rows as the end of the catalog and retire the control.
      if (added === 0) {
        setExhausted(true);
        setCursor(null);
      } else {
        setCursor(result.nextCursor ?? null);
      }
    } catch (err) {
      setError(toErrorShape(err));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, category]);

  function selectCategory(next: string) {
    setCategory(next);
    void load(next);
  }

  /** Phase is applied locally, so changing it must not refetch. */
  function selectStatus(next: string) {
    setStatus(next);
  }

  const visible = useMemo(() => {
    let rows = markets;
    // Phase filtering happens here, on each row's real `phase` value, because
    // Panta's upstream status parameter does not filter reliably.
    if (status) rows = rows.filter((market) => market.phase === status);

    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((market) => {
      const haystack = `${marketTitle(market)} ${market.description ?? ""} ${market.category}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [markets, deferredQuery, status]);

  const filtering = deferredQuery.trim().length > 0 || status !== "";

  return (
    <div>
      <div className="space-y-3">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5 14 14" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search loaded markets by question or category"
            aria-label="Search loaded markets"
            className="pp-input pl-9"
          />
        </div>

        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          role="group"
          aria-label="Filter by category"
        >
          <FilterChip active={category === ""} onClick={() => selectCategory("")}>
            All categories
          </FilterChip>
          {categoryList.map((slug) => (
            <FilterChip
              key={slug}
              active={category === slug}
              onClick={() => selectCategory(slug)}
            >
              {slug}
            </FilterChip>
          ))}
          {categoryList.length === 0 && (
            <button
              type="button"
              onClick={() => void reloadCategories()}
              disabled={reloadingCategories}
              className="shrink-0 whitespace-nowrap rounded-[var(--radius-chip)] border border-dashed border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {reloadingCategories ? "Loading categories…" : "Categories unavailable, retry"}
            </button>
          )}
        </div>

        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          role="group"
          aria-label="Filter by market phase"
        >
          {STATUS_FILTERS.map((option) => (
            <FilterChip
              key={option.value}
              active={status === option.value}
              onClick={() => selectStatus(option.value)}
              subtle
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span className="tabular">
          {loading
            ? "Loading markets…"
            : filtering
              ? `${visible.length} of ${markets.length} loaded markets match`
              : `${markets.length} market${markets.length === 1 ? "" : "s"} loaded`}
        </span>
        {filtering && (
          <span className="text-[var(--color-faint)]">
            Filters the loaded list, not the full Panta catalog
          </span>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <MarketGridSkeleton count={9} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void load(category)} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={filtering ? "No loaded markets match that search" : "No markets here yet"}
            description={
              filtering
                ? "Try a different term, clear the search, or load more markets to widen the set being filtered."
                : "Panta returned no markets for this category and phase combination. Try another filter."
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setDeferredQuery("");
                  selectCategory("");
                }}
                className="pp-btn pp-btn-secondary"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((market) => (
                <MarketCard key={market.marketId} market={market} />
              ))}
            </div>

            {exhausted && (
              <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
                End of the Panta catalog for this filter.
              </p>
            )}

            {cursor && !exhausted && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="pp-btn pp-btn-secondary"
                >
                  {loadingMore ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Load more markets"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  subtle = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[var(--radius-chip)] border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
        active
          ? subtle
            ? "border-[var(--color-border-strong)] bg-[var(--color-elevated)] text-[var(--color-text)]"
            : "border-[var(--color-accent)]/45 bg-[var(--color-accent-dim)]/55 text-[var(--color-accent)]"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}
