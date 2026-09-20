import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFlowChart } from "@/components/markets/ActivityFlowChart";
import { RecentActivity } from "@/components/markets/RecentActivity";
import { MarketImage, PhaseBadge } from "@/components/markets/MarketMeta";
import { MarketIntelligence } from "@/components/ai/MarketIntelligence";
import { TradePanel } from "@/components/trading/TradePanel";
import { MobileTradeSheet } from "@/components/trading/MobileTradeSheet";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { ErrorState } from "@/components/common/States";
import { AppError, toAppError } from "@/lib/panta/errors";
import { getMarket, getMarketTrades } from "@/lib/panta/markets";
import type { PantaCatalogTrade, PantaMarket } from "@/lib/panta/types";
import { marketTitle, marketSubtitle } from "@/lib/panta/display";
import { marketIdSchema } from "@/lib/validation/schemas";
import {
  UNAVAILABLE,
  formatImpliedPercent,
  formatPrice,
  formatUsdcDecimal,
} from "@/lib/utils/format";
import { formatDateTime, formatTimeUntil } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ marketId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marketId } = await params;
  if (!marketIdSchema.safeParse(marketId).success) return { title: "Market" };
  try {
    const market = await getMarket(marketId);
    return {
      title: marketTitle(market),
      description:
        market.description?.slice(0, 180) ||
        `Live Panta prediction market: ${marketTitle(market)}`,
    };
  } catch {
    return { title: "Market" };
  }
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { marketId } = await params;

  if (!marketIdSchema.safeParse(marketId).success) notFound();

  let market: PantaMarket;
  let trades: PantaCatalogTrade[] = [];

  try {
    market = await getMarket(marketId);
  } catch (err) {
    const appError = toAppError(err);
    if (appError.code === "MARKET_NOT_FOUND") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState
          error={{
            code: appError.code,
            message: appError.message,
            details: appError.details,
            retryable: appError.retryable,
          }}
        />
        <Link href="/markets" className="pp-btn pp-btn-secondary mt-4">
          Back to markets
        </Link>
      </div>
    );
  }

  // The trade tape is supplementary: its absence must not break the page.
  try {
    const tape = await getMarketTrades(marketId, 60);
    trades = tape.items;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
  }

  const hasPrices =
    market.yesPrice !== null &&
    market.yesPrice !== undefined &&
    market.noPrice !== null &&
    market.noPrice !== undefined;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:pb-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[var(--color-muted)]">
        <Link href="/markets" className="transition-colors hover:text-[var(--color-text)]">
          Markets
        </Link>
        <span aria-hidden className="mx-1.5 text-[var(--color-faint)]">
          /
        </span>
        <span className="capitalize">{market.category}</span>
      </nav>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
        {/* ---------------------------------------------------- main column */}
        <div className="min-w-0 space-y-5">
          <header className="pp-card p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <MarketImage
                images={market.images}
                title={marketTitle(market)}
                size={56}
                className="sm:h-16 sm:w-16"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold leading-snug tracking-tight sm:text-2xl">
                  {marketTitle(market)}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PhaseBadge phase={market.phase} />
                  <span className="pp-chip">{market.category}</span>
                  {market.marketType && market.marketType !== "standard" && (
                    <span className="pp-chip">{market.marketType}</span>
                  )}
                  {market.region && <span className="pp-chip">{market.region}</span>}
                </div>
              </div>
            </div>

            {marketSubtitle(market) && (
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
                {marketSubtitle(market)}
              </p>
            )}

            {/* Price header: the number a trader looks at first. */}
            <div className="mt-4">
              {hasPrices ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] px-4 py-4 text-center">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    Live pricing unavailable
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                    Panta did not return spot YES/NO prices for this market
                    {market.phase === "resolved"
                      ? " because it has resolved. Settlement is 1 USDC per winning share."
                      : " right now. Requesting a quote still returns the exact fill before you sign."}
                  </p>
                </div>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--color-border-subtle)] pt-4 sm:grid-cols-4">
              <Stat label="Volume" value={formatUsdcDecimal(market.volumeUsdc)} />
              <Stat
                label={market.phase === "primary" ? "Closes" : "Closed"}
                value={formatTimeUntil(market.endTime)}
              />
              <Stat label="Resolution" value={formatDateTime(market.resolutionTime)} />
              <Stat
                label="Status"
                value={market.status ? String(market.status) : UNAVAILABLE}
              />
            </dl>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3">
              <span className="font-mono text-[10px] text-[var(--color-faint)]">
                {market.marketId}
              </span>
              <PoweredByPanta variant="subtle" />
            </div>
          </header>

          {/* Mobile keeps question and pricing first, then the chart. */}
          <section className="pp-card p-4 sm:p-5" aria-labelledby="flow-heading">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 id="flow-heading" className="text-sm font-semibold text-[var(--color-text)]">
                Market activity flow
              </h2>
              <span className="pp-chip">Panta trade tape</span>
            </div>
            <ActivityFlowChart trades={trades} />
          </section>

          <MarketIntelligence
            marketId={market.marketId}
            analysable={Boolean(market.title?.trim() || market.description?.trim())}
          />

          {(market.oracle || market.resolutionTime) && (
            <section className="pp-card p-4 sm:p-5" aria-labelledby="resolution-heading">
              <h2
                id="resolution-heading"
                className="text-sm font-semibold text-[var(--color-text)]"
              >
                Resolution
              </h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                {market.oracle && (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
                      Sources of truth
                    </dt>
                    <dd className="mt-1 break-words text-[var(--color-muted)]">
                      {market.oracle}
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
                      Opens
                    </dt>
                    <dd className="tabular mt-1 text-[var(--color-muted)]">
                      {formatDateTime(market.startTime)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
                      Closes
                    </dt>
                    <dd className="tabular mt-1 text-[var(--color-muted)]">
                      {formatDateTime(market.endTime)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
                      Resolves
                    </dt>
                    <dd className="tabular mt-1 text-[var(--color-muted)]">
                      {formatDateTime(market.resolutionTime)}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>
          )}

          <section className="pp-card p-4 sm:p-5" aria-labelledby="activity-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2
                id="activity-heading"
                className="text-sm font-semibold text-[var(--color-text)]"
              >
                Recent activity
              </h2>
              <span className="tabular text-xs text-[var(--color-muted)]">
                {trades.length} trade{trades.length === 1 ? "" : "s"}
              </span>
            </div>
            <RecentActivity trades={trades} />
          </section>
        </div>

        {/* ------------------------------------------------- sticky trade rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <TradePanel market={market} />
          </div>
        </aside>
      </div>

      <MobileTradeSheet market={market} />
    </div>
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
  const isYes = tone === "yes";
  return (
    <div
      className={`rounded-[var(--radius-control)] border px-4 py-3 ${
        isYes
          ? "border-[var(--color-yes)]/25 bg-[var(--color-yes-dim)]/45"
          : "border-[var(--color-no)]/25 bg-[var(--color-no-dim)]/45"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            isYes ? "text-[var(--color-yes)]" : "text-[var(--color-no)]"
          }`}
        >
          {label}
        </span>
        <span
          className={`tabular text-2xl font-bold leading-none sm:text-3xl ${
            isYes ? "text-[var(--color-yes)]" : "text-[var(--color-no)]"
          }`}
        >
          {percent}
        </span>
      </div>
      <p className="tabular mt-1.5 text-xs text-[var(--color-muted)]">
        {price} USDC per share
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
        {label}
      </dt>
      <dd className="tabular mt-1 truncate text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
