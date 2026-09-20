import Link from "next/link";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { HeroAiInsight } from "@/components/home/HeroAiInsight";
import { marketTitle } from "@/lib/panta/display";
import type { PantaCatalogTrade, PantaMarket } from "@/lib/panta/types";
import {
  UNAVAILABLE,
  formatCompactUsdc,
  formatImpliedPercent,
  formatPrice,
  shareBaseUnitsToNumber,
} from "@/lib/utils/format";
import { formatTimeUntil } from "@/lib/utils/time";

/**
 * Live intelligence card for the homepage hero.
 *
 * Every value here is a real field from one real Panta market: pricing, volume
 * and close time come from the catalog/detail row, the signal strip is computed
 * from that market's own trade tape, and the AI line is generated on demand
 * from the same market. Nothing is sampled, seeded or illustrative.
 *
 * Where Panta has no data the card says so rather than substituting a value,
 * which is why the trade strip has an explicit empty state instead of an
 * flat-line chart.
 */

/** Newest trades shown in the signal strip. Older ones still count in totals. */
const MAX_BARS = 22;

export type FlowTotals = {
  yesShares: number;
  noShares: number;
  bars: { shares: number; side: "yes" | "no" }[];
};

/**
 * Reduces the tape to YES/NO share flow.
 *
 * `yesAmount` / `noAmount` are 1e6 base units. A row carries one side or the
 * other, so a row with neither is skipped rather than counted as zero.
 */
export function readFlow(trades: PantaCatalogTrade[]): FlowTotals {
  let yesShares = 0;
  let noShares = 0;
  const bars: FlowTotals["bars"] = [];

  for (const trade of trades) {
    const yes = shareBaseUnitsToNumber(trade.yesAmount) ?? 0;
    const no = shareBaseUnitsToNumber(trade.noAmount) ?? 0;
    if (yes > 0) {
      yesShares += yes;
      bars.push({ shares: yes, side: "yes" });
    } else if (no > 0) {
      noShares += no;
      bars.push({ shares: no, side: "no" });
    }
  }

  // Panta returns newest first; the strip reads left to right, oldest to newest.
  return { yesShares, noShares, bars: bars.slice(0, MAX_BARS).reverse() };
}

export function HeroIntelligenceCard({
  market,
  trades,
  tradesUnavailable = false,
}: {
  market: PantaMarket;
  trades: PantaCatalogTrade[];
  /** True when the tape request itself failed, which is not the same as no trades. */
  tradesUnavailable?: boolean;
}) {
  const flow = readFlow(trades);
  const totalShares = flow.yesShares + flow.noShares;
  const yesShare = totalShares > 0 ? (flow.yesShares / totalShares) * 100 : null;
  const hasPricing =
    market.yesPrice !== null &&
    market.yesPrice !== undefined &&
    market.noPrice !== null &&
    market.noPrice !== undefined;
  const peakBar = flow.bars.reduce((max, bar) => Math.max(max, bar.shares), 0);

  return (
    <article className="pp-card flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 sm:px-5">
        <span className="pp-chip normal-case">
          <span
            aria-hidden
            className="pp-live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
          />
          Live market
        </span>
        <span className="tabular shrink-0 text-xs text-[var(--color-muted)]">
          {formatTimeUntil(market.endTime)}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <Link
          href={`/markets/${market.marketId}`}
          className="text-[15px] font-semibold leading-snug tracking-tight transition-colors hover:text-[var(--color-accent)]"
        >
          {marketTitle(market)}
        </Link>

        {hasPricing ? (
          <div className="grid grid-cols-2 gap-2.5">
            <PriceTile
              label="YES"
              percent={formatImpliedPercent(market.yesPrice)}
              price={formatPrice(market.yesPrice)}
              tone="yes"
            />
            <PriceTile
              label="NO"
              percent={formatImpliedPercent(market.noPrice)}
              price={formatPrice(market.noPrice)}
              tone="no"
            />
          </div>
        ) : (
          <p className="rounded-[var(--radius-chip)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-2.5 text-xs text-[var(--color-muted)]">
            Panta returned no YES/NO pricing for this market right now.
          </p>
        )}

        <section aria-label="Recent trade activity">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
              Share flow
            </h3>
            {yesShare !== null ? (
              <span className="tabular text-[11px] text-[var(--color-muted)]">
                {Math.round(yesShare)}% YES / {Math.round(100 - yesShare)}% NO
              </span>
            ) : null}
          </div>

          {tradesUnavailable ? (
            <p className="text-xs text-[var(--color-muted)]">
              Trade tape unavailable from Panta right now.
            </p>
          ) : flow.bars.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">
              No trades on this market&apos;s tape yet.
            </p>
          ) : (
            <>
              {/* Proportion of YES vs NO shares bought across the sampled tape.
                  This is the part that reads correctly at any trade count. */}
              <div
                className="flex h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
                role="img"
                aria-label={`${Math.round(
                  yesShare ?? 0,
                )} percent of shares bought were YES, ${Math.round(
                  100 - (yesShare ?? 0),
                )} percent NO`}
              >
                <span
                  className="bg-[var(--color-yes)]"
                  style={{ width: `${yesShare ?? 0}%` }}
                />
                <span
                  className="bg-[var(--color-no)]"
                  style={{ width: `${100 - (yesShare ?? 0)}%` }}
                />
              </div>

              {/* Per-trade tape. Ticks are a FIXED width and sit next to their
                  label rather than stretching across the card: most Panta
                  markets have only a handful of trades, and any full-width
                  treatment of four bars reads as a broken chart instead of as
                  genuinely sparse activity. */}
              <div className="mt-2.5 flex items-end justify-between gap-3">
                <span className="text-[11px] text-[var(--color-muted)]">
                  Last {flow.bars.length} {flow.bars.length === 1 ? "trade" : "trades"}
                </span>
                <div
                  className="flex h-6 items-end gap-[2px]"
                  role="img"
                  aria-label={`Sizes of the last ${flow.bars.length} trades, oldest first`}
                >
                  {flow.bars.map((bar, index) => (
                    <span
                      key={index}
                      className={
                        bar.side === "yes"
                          ? "w-[4px] rounded-[1px] bg-[var(--color-yes)]"
                          : "w-[4px] rounded-[1px] bg-[var(--color-no)]"
                      }
                      // Linear in share size. The floor only stops the smallest
                      // trade rendering as an invisible hairline.
                      style={{
                        height: `${Math.max(
                          26,
                          peakBar > 0 ? (bar.shares / peakBar) * 100 : 0,
                        )}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <dl className="grid grid-cols-2 gap-2.5 border-t border-[var(--color-border-subtle)] pt-3.5">
          <Stat
            label="Volume"
            value={
              market.volumeUsdc ? formatCompactUsdc(market.volumeUsdc) : UNAVAILABLE
            }
          />
          <Stat
            label="Trades sampled"
            value={tradesUnavailable ? UNAVAILABLE : String(trades.length)}
          />
        </dl>

        <HeroAiInsight marketId={market.marketId} />
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] px-4 py-3 sm:px-5">
        <PoweredByPanta variant="subtle" />
        <Link
          href={`/markets/${market.marketId}`}
          className="shrink-0 text-xs font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-bright)]"
        >
          Open market →
        </Link>
      </footer>
    </article>
  );
}

function PriceTile({
  label,
  percent,
  price,
  tone,
}: {
  label: string;
  percent: string;
  price: string;
  tone: "yes" | "no";
}) {
  return (
    <div
      className={
        tone === "yes"
          ? "rounded-[var(--radius-chip)] border border-[var(--color-yes-dim)] bg-[var(--color-surface-2)] px-3 py-2.5"
          : "rounded-[var(--radius-chip)] border border-[var(--color-no-dim)] bg-[var(--color-surface-2)] px-3 py-2.5"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={
            tone === "yes"
              ? "text-[11px] font-bold tracking-wider text-[var(--color-yes)]"
              : "text-[11px] font-bold tracking-wider text-[var(--color-no)]"
          }
        >
          {label}
        </span>
        <span className="tabular text-[11px] text-[var(--color-faint)]">{price}</span>
      </div>
      <p className="tabular mt-0.5 text-xl font-semibold tracking-tight">{percent}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

/** Matches the card's shape so the hero does not jump when data arrives. */
export function HeroIntelligenceCardSkeleton() {
  return (
    <div className="pp-card overflow-hidden" aria-hidden>
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3 sm:px-5">
        <div className="pp-skeleton h-6 w-28 rounded-full" />
        <div className="pp-skeleton h-4 w-16 rounded" />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="pp-skeleton h-5 w-full rounded" />
        <div className="pp-skeleton h-4 w-2/3 rounded" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="pp-skeleton h-16 rounded" />
          <div className="pp-skeleton h-16 rounded" />
        </div>
        <div className="pp-skeleton h-12 rounded" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="pp-skeleton h-9 rounded" />
          <div className="pp-skeleton h-9 rounded" />
        </div>
        <div className="pp-skeleton h-16 rounded" />
      </div>
    </div>
  );
}
