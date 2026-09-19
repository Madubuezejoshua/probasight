"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { EmptyState, ErrorState, RowSkeleton, Spinner } from "@/components/common/States";
import { MarketImage, PhaseBadge } from "@/components/markets/MarketMeta";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import { explorerTxUrl } from "@/lib/env";
import type { EnrichedPosition } from "@/app/api/panta/positions/route";
import type { PantaCatalogTrade, PantaMarket } from "@/lib/panta/types";
import { marketTitle } from "@/lib/panta/display";
import {
  UNAVAILABLE,
  formatShareBaseUnits,
  formatShares,
  formatUsdcDecimal,
  truncateAddress,
} from "@/lib/utils/format";
import { formatRelative } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { AttributionStatus } from "@/components/trading/AttributionStatus";
import { CLAIM_STAGE_LABELS, useClaimFlow } from "./useClaimFlow";

type PositionsResponse = {
  wallet: string;
  positions: EnrichedPosition[];
  truncatedMarketLookups: boolean;
};

type CreatedResponse = {
  wallet: string;
  markets: PantaMarket[];
  creatorFilterApplied: boolean;
  /** Which upstream path produced this list; see the created-markets route. */
  source?: "createdBy" | "partnerFlag";
};

type Tab = "open" | "claimable" | "activity" | "created";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "open", label: "Open Positions" },
  { id: "claimable", label: "Claimable" },
  { id: "activity", label: "Activity" },
  { id: "created", label: "Created Markets" },
];

export function PortfolioDashboard() {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [tab, setTab] = useState<Tab>("open");
  const [positions, setPositions] = useState<EnrichedPosition[] | null>(null);
  const [trades, setTrades] = useState<PantaCatalogTrade[] | null>(null);
  const [created, setCreated] = useState<CreatedResponse | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [indexing, setIndexing] = useState(false);

  const claimFlow = useClaimFlow();

  const loadAll = useCallback(
    async (target: string) => {
      setLoading(true);
      setError(null);
      try {
        const [positionsResult, tradesResult] = await Promise.all([
          apiFetch<PositionsResponse>("/api/panta/positions", { query: { wallet: target } }),
          apiFetch<{ items: PantaCatalogTrade[] }>("/api/panta/wallet-trades", {
            query: { wallet: target, limit: 100 },
          }).catch(() => ({ items: [] as PantaCatalogTrade[] })),
        ]);
        setPositions(positionsResult.positions);
        setTruncated(positionsResult.truncatedMarketLookups);
        setTrades(tradesResult.items);
      } catch (err) {
        setError(toErrorShape(err));
        setPositions(null);
        setTrades(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadCreated = useCallback(async (target: string) => {
    try {
      const result = await apiFetch<CreatedResponse>("/api/panta/created-markets", {
        query: { wallet: target },
      });
      setCreated(result);
    } catch (err) {
      setCreated({ wallet: target, markets: [], creatorFilterApplied: false });
      // Surfaced inline in the Created tab rather than as a page-level failure.
      void err;
    }
  }, []);

  useEffect(() => {
    if (!wallet) {
      setPositions(null);
      setTrades(null);
      setCreated(null);
      return;
    }
    void loadAll(wallet);
  }, [wallet, loadAll]);

  useEffect(() => {
    if (tab === "created" && wallet && !created) void loadCreated(wallet);
  }, [tab, wallet, created, loadCreated]);

  /**
   * After a claim, Panta's indexer can lag the chain. Refetch on a short bounded
   * schedule and show an honest "updating" state rather than declaring failure.
   */
  useEffect(() => {
    if (claimFlow.stage !== "completed" || !wallet) return;
    setIndexing(true);
    const delays = [2500, 6000, 12000];
    const timers = delays.map((delay) =>
      setTimeout(() => void loadAll(wallet), delay),
    );
    const done = setTimeout(() => setIndexing(false), 13000);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [claimFlow.stage, wallet, loadAll]);

  const open = useMemo(
    () => (positions ?? []).filter((p) => !p.claimable && !p.claimed),
    [positions],
  );
  const claimable = useMemo(
    () => (positions ?? []).filter((p) => p.claimable && !p.claimed),
    [positions],
  );

  const totalValue = useMemo(() => {
    const valued = (positions ?? []).filter((p) => p.estimatedValueUsdc !== null);
    if (valued.length === 0) return null;
    return {
      total: valued.reduce((sum, p) => sum + (p.estimatedValueUsdc ?? 0), 0),
      valuedCount: valued.length,
      totalCount: (positions ?? []).length,
    };
  }, [positions]);

  if (!connected || !wallet) {
    return (
      <div className="pp-card px-6 py-16 text-center">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          Connect your Solana wallet to view your Panta positions
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
          Your wallet is your identity here. There is no account to create and no password
          to set — Panta Pulse reads your positions and activity directly from Panta using
          your public address.
        </p>
        <div className="mt-6 flex justify-center">
          <ConnectWalletButton />
        </div>
        <PoweredByPanta variant="subtle" className="mt-6" />
      </div>
    );
  }

  return (
    <div>
      {/* Stat strip: only metrics that can be truthfully derived. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Wallet"
          value={truncateAddress(wallet, 5)}
          mono
          hint={<PoweredByPanta variant="subtle" />}
        />
        <StatCard
          label="Est. position value"
          value={
            loading
              ? "…"
              : totalValue
                ? formatUsdcDecimal(totalValue.total)
                : "Value unavailable"
          }
          hint={
            totalValue && totalValue.valuedCount < totalValue.totalCount ? (
              <span className="text-[10px] text-[var(--color-warning)]">
                {totalValue.valuedCount}/{totalValue.totalCount} positions priced
              </span>
            ) : totalValue ? (
              <span className="text-[10px] text-[var(--color-faint)]">
                Mark-to-market, not settlement
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-faint)]">
                No usable price reference
              </span>
            )
          }
        />
        <StatCard
          label="Open positions"
          value={loading ? "…" : String(open.length)}
        />
        <StatCard
          label="Claimable"
          value={loading ? "…" : String(claimable.length)}
          accent={claimable.length > 0}
        />
      </div>

      {truncated && (
        <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-dim)]/40 p-2.5 text-xs text-[var(--color-warning)]">
          This wallet holds positions in more markets than we price per request. Some rows
          show &ldquo;Value unavailable&rdquo; rather than an estimate.
        </p>
      )}

      {indexing && (
        <p className="mt-3 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-2.5 text-xs text-[var(--color-muted)]">
          <Spinner className="text-[var(--color-accent)]" />
          Position is updating. Panta&apos;s indexer can lag the chain briefly after a
          transaction.
        </p>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Portfolio sections"
        className="-mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border-subtle)] px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-[var(--color-accent)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {item.label}
            {item.id === "claimable" && claimable.length > 0 && (
              <span className="tabular ml-1.5 rounded-full bg-[var(--color-accent-dim)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                {claimable.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <RowSkeleton rows={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void loadAll(wallet)} />
        ) : tab === "open" ? (
          open.length === 0 ? (
            <EmptyState
              title="No open positions"
              description="Panta reports no open holdings for this wallet. Positions appear here once a primary buy is confirmed and indexed."
              action={
                <Link href="/markets" className="pp-btn pp-btn-primary">
                  Explore markets
                </Link>
              }
            />
          ) : (
            <PositionList positions={open} />
          )
        ) : tab === "claimable" ? (
          claimable.length === 0 ? (
            <EmptyState
              title="Nothing to claim yet"
              description="Winnings appear here only once Panta marks a position claimable, which happens after the market resolves. This interface never enables a claim before Panta says it is eligible."
            />
          ) : (
            <ClaimableList positions={claimable} flow={claimFlow} />
          )
        ) : tab === "activity" ? (
          <ActivityTable trades={trades ?? []} />
        ) : (
          <CreatedMarkets data={created} flow={claimFlow} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function StatCard({
  label,
  value,
  hint,
  mono,
  accent,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="pp-card p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 truncate text-lg font-semibold",
          mono && "font-mono text-base",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]",
        )}
      >
        {value}
      </p>
      {hint && <div className="mt-1.5">{hint}</div>}
    </div>
  );
}

function PositionList({ positions }: { positions: EnrichedPosition[] }) {
  return (
    <ul className="space-y-2">
      {positions.map((position) => (
        <li
          key={`${position.marketId}-${position.side}`}
          className="pp-card p-3.5 transition-colors hover:border-[var(--color-border-strong)]"
        >
          <div className="flex items-start gap-3">
            <MarketImage
              images={position.market?.images}
              title={position.market ? marketTitle(position.market) : position.marketId}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/markets/${position.marketId}`}
                className="line-clamp-2 text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]"
              >
                {position.market ? marketTitle(position.market) : position.marketId}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <SideTag side={position.side} />
                <PhaseBadge phase={position.phase} />
                {position.category && (
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-faint)]">
                    {position.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border-subtle)] pt-3">
            <Metric label="Shares" value={formatShares(position.shares)} />
            <Metric
              label="Price"
              value={
                position.market
                  ? position.side === "yes"
                    ? position.market.yesPrice
                      ? `${Number(position.market.yesPrice).toFixed(3)}`
                      : UNAVAILABLE
                    : position.market.noPrice
                      ? `${Number(position.market.noPrice).toFixed(3)}`
                      : UNAVAILABLE
                  : UNAVAILABLE
              }
            />
            <Metric
              label="Est. value"
              value={
                position.estimatedValueUsdc !== null
                  ? formatUsdcDecimal(position.estimatedValueUsdc)
                  : "Unavailable"
              }
              align="right"
            />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function ClaimableList({
  positions,
  flow,
}: {
  positions: EnrichedPosition[];
  flow: ReturnType<typeof useClaimFlow>;
}) {
  return (
    <ul className="space-y-2">
      {positions.map((position) => {
        const active = flow.activeMarketId === position.marketId;
        const busy =
          active && !["idle", "completed", "error"].includes(flow.stage);
        const done = active && flow.stage === "completed" && flow.result;

        return (
          <li
            key={`${position.marketId}-${position.side}`}
            className="pp-card border-[var(--color-accent)]/25 p-3.5"
          >
            <div className="flex items-start gap-3">
              <MarketImage
                images={position.market?.images}
                title={position.market ? marketTitle(position.market) : position.marketId}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/markets/${position.marketId}`}
                  className="line-clamp-2 text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]"
                >
                  {position.market ? marketTitle(position.market) : position.marketId}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <SideTag side={position.side} />
                  {position.outcome && (
                    <span className="pp-chip">Outcome {position.outcome}</span>
                  )}
                  <span className="tabular text-xs text-[var(--color-muted)]">
                    {formatShares(position.shares)} shares
                  </span>
                </div>
              </div>
            </div>

            {done && flow.result ? (
              <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--color-yes)]/30 bg-[var(--color-yes-dim)]/40 p-3">
                <p className="text-xs font-semibold text-[var(--color-yes)]">
                  Claim submitted — {flow.result.amountLabel}
                </p>
                <a
                  href={explorerTxUrl(flow.result.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block font-mono text-[11px] text-[var(--color-accent)] hover:underline"
                >
                  {truncateAddress(flow.result.signature, 6)} ↗
                </a>
                {flow.result.warning && (
                  <p className="mt-1.5 text-[11px] text-[var(--color-warning)]">
                    {flow.result.warning}
                  </p>
                )}
                {/* Win claims are attributable, so the loop is closable here too. */}
                <div className="mt-2.5">
                  <AttributionStatus
                    signature={flow.result.signature}
                    initialStatus={flow.result.attributionStatus}
                  />
                </div>
              </div>
            ) : (
              <>
                {active && flow.error && (
                  <div className="mt-3">
                    <ErrorState error={flow.error} compact />
                  </div>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void flow.claim(position.marketId, "winnings")}
                  className="pp-btn pp-btn-primary mt-3 w-full"
                >
                  {busy ? (
                    <>
                      <Spinner /> {CLAIM_STAGE_LABELS[flow.stage]}
                    </>
                  ) : (
                    "Claim winnings"
                  )}
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ActivityTable({ trades }: { trades: PantaCatalogTrade[] }) {
  if (trades.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Panta has no recorded trades for this wallet. Confirmed trades appear here once indexed."
      />
    );
  }

  const sorted = [...trades].sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

  return (
    <div className="pp-card overflow-hidden">
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50 text-left">
              <th scope="col" className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Market
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                YES
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                NO
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Fee
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Time
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Tx
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((trade, index) => (
              <tr
                key={trade.signature ?? index}
                className="border-b border-[var(--color-border-subtle)]/60 last:border-0"
              >
                <td className="px-3.5 py-2.5">
                  {trade.marketId ? (
                    <Link
                      href={`/markets/${trade.marketId}`}
                      className="font-mono text-xs text-[var(--color-accent)] hover:underline"
                    >
                      {truncateAddress(trade.marketId, 5)}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-faint)]">{UNAVAILABLE}</span>
                  )}
                </td>
                <td className="tabular px-3.5 py-2.5 text-right text-[var(--color-yes)]">
                  {formatShareBaseUnits(trade.yesAmount)}
                </td>
                <td className="tabular px-3.5 py-2.5 text-right text-[var(--color-no)]">
                  {formatShareBaseUnits(trade.noAmount)}
                </td>
                <td className="tabular px-3.5 py-2.5 text-right text-[var(--color-muted)]">
                  {formatShareBaseUnits(trade.feePaid)}
                </td>
                <td className="tabular px-3.5 py-2.5 text-right text-[var(--color-muted)]">
                  {formatRelative(trade.blockTime)}
                </td>
                <td className="px-3.5 py-2.5 text-right">
                  {trade.signature ? (
                    <a
                      href={explorerTxUrl(trade.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[var(--color-accent)] hover:underline"
                    >
                      ↗
                    </a>
                  ) : (
                    <span className="text-[var(--color-faint)]">{UNAVAILABLE}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[var(--color-border-subtle)] sm:hidden">
        {sorted.map((trade, index) => (
          <li key={trade.signature ?? index} className="p-3.5">
            <div className="flex items-center justify-between">
              {trade.marketId ? (
                <Link
                  href={`/markets/${trade.marketId}`}
                  className="font-mono text-xs text-[var(--color-accent)]"
                >
                  {truncateAddress(trade.marketId, 5)}
                </Link>
              ) : (
                <span className="text-xs text-[var(--color-faint)]">{UNAVAILABLE}</span>
              )}
              <span className="tabular text-xs text-[var(--color-muted)]">
                {formatRelative(trade.blockTime)}
              </span>
            </div>
            <div className="tabular mt-2 flex gap-4 text-xs">
              <span className="text-[var(--color-yes)]">
                YES {formatShareBaseUnits(trade.yesAmount)}
              </span>
              <span className="text-[var(--color-no)]">
                NO {formatShareBaseUnits(trade.noAmount)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreatedMarkets({
  data,
  flow,
}: {
  data: CreatedResponse | null;
  flow: ReturnType<typeof useClaimFlow>;
}) {
  if (!data) return <RowSkeleton rows={3} />;

  if (data.markets.length === 0) {
    return (
      <EmptyState
        title="No created markets"
        description="Markets you create through Panta Pulse appear here. Panta scopes creation history to the API account, so only markets created through this application are listed."
        action={
          <Link href="/create" className="pp-btn pp-btn-primary">
            Create a market
          </Link>
        }
      />
    );
  }

  return (
    <div>
      {!data.creatorFilterApplied && (
        <p className="mb-3 rounded-[var(--radius-control)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-dim)]/40 p-2.5 text-xs leading-relaxed text-[var(--color-warning)]">
          Panta&apos;s catalog does not expose a creator wallet on these rows, so this list
          shows every market created through this application rather than only yours.
          Panta still enforces ownership: a creator-fee claim from a wallet that did not
          create the market is rejected with NOT_MARKET_CREATOR.
        </p>
      )}

      <ul className="space-y-2">
        {data.markets.map((market) => {
          const active = flow.activeMarketId === market.marketId;
          const busy = active && !["idle", "completed", "error"].includes(flow.stage);
          const done = active && flow.stage === "completed" && flow.result;

          return (
            <li key={market.marketId} className="pp-card p-3.5">
              <div className="flex items-start gap-3">
                <MarketImage images={market.images} title={marketTitle(market)} size={40} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/markets/${market.marketId}`}
                    className="line-clamp-2 text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]"
                  >
                    {marketTitle(market)}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <PhaseBadge phase={market.phase} />
                    <span className="tabular text-xs text-[var(--color-muted)]">
                      Vol {formatUsdcDecimal(market.volumeUsdc)}
                    </span>
                  </div>
                </div>
              </div>

              {done && flow.result ? (
                <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--color-yes)]/30 bg-[var(--color-yes-dim)]/40 p-3">
                  <p className="text-xs font-semibold text-[var(--color-yes)]">
                    Creator fees claimed — {flow.result.amountLabel}
                  </p>
                  <a
                    href={explorerTxUrl(flow.result.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block font-mono text-[11px] text-[var(--color-accent)] hover:underline"
                  >
                    {truncateAddress(flow.result.signature, 6)} ↗
                  </a>
                </div>
              ) : (
                <>
                  {active && flow.error && (
                    <div className="mt-3">
                      <ErrorState error={flow.error} compact />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void flow.claim(market.marketId, "creator-fees")}
                    className="pp-btn pp-btn-secondary mt-3 w-full"
                  >
                    {busy ? (
                      <>
                        <Spinner /> {CLAIM_STAGE_LABELS[flow.stage]}
                      </>
                    ) : (
                      "Claim creator fees"
                    )}
                  </button>
                  <p className="pp-hint mt-2">
                    Panta allows creator-fee claims only on graduated markets with
                    accumulated fees, and only from the creator wallet.
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SideTag({ side }: { side: "yes" | "no" }) {
  const isYes = side === "yes";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-chip)] border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isYes
          ? "border-[var(--color-yes)]/30 bg-[var(--color-yes-dim)]/50 text-[var(--color-yes)]"
          : "border-[var(--color-no)]/30 bg-[var(--color-no-dim)]/50 text-[var(--color-no)]",
      )}
    >
      {side}
    </span>
  );
}

function Metric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
