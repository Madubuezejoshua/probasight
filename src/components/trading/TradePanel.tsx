"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { ErrorState, Spinner } from "@/components/common/States";
import { explorerTxUrl } from "@/lib/env";
import type { MarketSide, PantaMarket } from "@/lib/panta/types";
import {
  UNAVAILABLE,
  formatImpliedPercent,
  formatPrice,
  parseUsdcAmount,
  toUsdcAmountString,
  truncateAddress,
} from "@/lib/utils/format";
import { secondsUntilIso } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { STAGE_LABELS, useTradeFlow } from "./useTradeFlow";
import { AttributionStatus } from "./AttributionStatus";

const QUICK_AMOUNTS = [5, 10, 25, 100];
const DEFAULT_SLIPPAGE_BPS = 100;

/**
 * Panta primary buy ticket.
 *
 * Scoped precisely to what the Panta API supports: a YES/NO side, a USDC
 * deposit amount, and a quoted fill on the bonding curve. There are no limit
 * orders, no sells and no order book, because the primary-buy endpoint does not
 * expose them.
 */
export function TradePanel({
  market,
  onTraded,
  variant = "rail",
}: {
  market: PantaMarket;
  onTraded?: () => void;
  variant?: "rail" | "sheet";
}) {
  const { connected } = useWallet();
  const [side, setSide] = useState<MarketSide>("yes");
  const [amount, setAmount] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const { stage, quote, error, result, getQuote, execute, reset, clearQuote } = useTradeFlow(
    market.marketId,
  );

  const tradable = market.phase === "primary";
  const parsedAmount = parseUsdcAmount(amount);
  const busy = ![
    "idle",
    "quoted",
    "error",
    "completed",
  ].includes(stage);

  // A quote is only valid for ~90s; count it down and expire it in the UI so a
  // stale quote is never carried into a signing prompt.
  useEffect(() => {
    if (!quote?.expiresAt) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = secondsUntilIso(quote.expiresAt);
      setCountdown(remaining);
      if (remaining !== null && remaining <= 0) clearQuote();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [quote?.expiresAt, clearQuote]);

  // Changing the side or amount invalidates the quote it was priced for.
  useEffect(() => {
    if (quote) clearQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, amount]);

  useEffect(() => {
    if (stage === "completed") onTraded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const priceForSide = side === "yes" ? market.yesPrice : market.noPrice;
  const hasPrice = priceForSide !== null && priceForSide !== undefined;

  const estimate = useMemo(() => {
    if (!quote) return null;
    return {
      shares: quote.shares,
      avgPrice: quote.avgPrice,
      fee: quote.feeUsdc,
    };
  }, [quote]);

  // ---------------------------------------------------------------- states

  if (!tradable) {
    return (
      <PanelShell variant={variant}>
        <NotTradableState market={market} />
      </PanelShell>
    );
  }

  if (stage === "completed" && result) {
    return (
      <PanelShell variant={variant}>
        <div className="pp-fade">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-yes-dim)] text-xs font-bold text-[var(--color-yes)]"
            >
              ✓
            </span>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Trade completed
            </h3>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Side">
              <span
                className={cn(
                  "font-semibold uppercase",
                  result.side === "yes"
                    ? "text-[var(--color-yes)]"
                    : "text-[var(--color-no)]",
                )}
              >
                {result.side}
              </span>
            </Row>
            <Row label="Amount">
              <span className="tabular">{result.amountUsdc} USDC</span>
            </Row>
            <Row label="Shares">
              <span className="tabular">{result.expectedShares}</span>
            </Row>
            <Row label="Panta order">
              <span className="font-mono text-xs">{result.pantaOrderStatus}</span>
            </Row>
            <Row label="Signature">
              <a
                href={explorerTxUrl(result.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--color-accent)] hover:underline"
              >
                {truncateAddress(result.signature, 6)} ↗
              </a>
            </Row>
          </dl>

          {/* Live attribution state, re-checkable against Panta. */}
          <div className="mt-3">
            <AttributionStatus
              signature={result.signature}
              initialStatus={result.attributionStatus}
            />
          </div>

          {result.postBroadcastWarning && (
            <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-dim)]/50 p-2.5 text-xs leading-relaxed text-[var(--color-warning)]">
              {result.postBroadcastWarning}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Link href="/portfolio" className="pp-btn pp-btn-primary flex-1">
              View position
            </Link>
            <button
              type="button"
              onClick={() => {
                reset();
                setAmount("");
              }}
              className="pp-btn pp-btn-secondary"
            >
              Trade again
            </button>
          </div>
          <PoweredByPanta variant="subtle" className="mt-4" />
        </div>
      </PanelShell>
    );
  }

  // ----------------------------------------------------------------- form

  return (
    <PanelShell variant={variant}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Trade</h3>
        <span className="pp-chip">Primary</span>
      </div>

      {/* Side selector. Colour is reinforced by an explicit label and aria-pressed. */}
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Choose outcome">
        <SideButton
          side="yes"
          active={side === "yes"}
          onClick={() => setSide("yes")}
          percent={formatImpliedPercent(market.yesPrice)}
          price={market.yesPrice}
        />
        <SideButton
          side="no"
          active={side === "no"}
          onClick={() => setSide("no")}
          percent={formatImpliedPercent(market.noPrice)}
          price={market.noPrice}
        />
      </div>

      {!hasPrice && (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Panta did not return a spot price for this side. A quote will still return the
          exact fill before you sign.
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="trade-amount" className="pp-label">
          Amount (USDC)
        </label>
        <input
          id="trade-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          disabled={busy}
          aria-describedby="trade-amount-hint"
          className="pp-input tabular text-lg font-semibold"
        />
        <div className="mt-2 flex gap-1.5">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => setAmount(String(value))}
              className="flex-1 rounded-[var(--radius-chip)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] py-1.5 text-xs font-semibold text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {value}
            </button>
          ))}
        </div>
        <p id="trade-amount-hint" className="pp-hint mt-2">
          You deposit USDC and receive {side.toUpperCase()} shares on Panta&apos;s bonding
          curve. Each winning share settles at 1 USDC.
        </p>
      </div>

      {/* Quote preview */}
      {quote && (
        <div className="pp-fade mt-4 rounded-[var(--radius-control)] border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)]/25 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              Quote ready
            </span>
            {countdown !== null && countdown > 0 && (
              <span className="tabular text-[11px] text-[var(--color-muted)]">
                expires in {countdown}s
              </span>
            )}
          </div>
          <dl className="mt-2.5 space-y-1.5 text-sm">
            <Row label="Estimated shares">
              <span className="tabular font-semibold">{estimate?.shares ?? UNAVAILABLE}</span>
            </Row>
            <Row label="Average price">
              <span className="tabular">{formatPrice(estimate?.avgPrice)} USDC</span>
            </Row>
            <Row label="Protocol fee">
              <span className="tabular">{estimate?.fee ?? UNAVAILABLE} USDC</span>
            </Row>
          </dl>
        </div>
      )}

      {/* Status line */}
      {busy && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-2.5">
          <Spinner className="text-[var(--color-accent)]" />
          <span className="text-xs font-medium text-[var(--color-text)]">
            {STAGE_LABELS[stage]}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorState error={error} compact onRetry={undefined} />
        </div>
      )}

      {/* Primary action */}
      <div className="mt-4">
        {!connected ? (
          <ConnectWalletButton className="w-full" />
        ) : !quote ? (
          <button
            type="button"
            disabled={!parsedAmount || busy}
            onClick={() => {
              if (!parsedAmount) return;
              void getQuote(side, toUsdcAmountString(parsedAmount));
            }}
            className="pp-btn pp-btn-primary w-full"
          >
            {stage === "quoting" ? (
              <>
                <Spinner /> Getting quote…
              </>
            ) : (
              "Get quote"
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void execute(quote, DEFAULT_SLIPPAGE_BPS)}
            className={cn(
              "pp-btn w-full",
              side === "yes"
                ? "bg-[var(--color-yes)] text-[#05210f] hover:brightness-110"
                : "bg-[var(--color-no)] text-[#2a0710] hover:brightness-110",
            )}
          >
            {busy ? (
              <>
                <Spinner /> {STAGE_LABELS[stage]}
              </>
            ) : (
              `Trade ${side.toUpperCase()}`
            )}
          </button>
        )}
      </div>

      <p className="pp-hint mt-3">
        Your wallet signs every transaction. ProbaSight never holds your keys or funds.
      </p>
      <PoweredByPanta variant="subtle" className="mt-3" />
    </PanelShell>
  );
}

function PanelShell({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "rail" | "sheet";
}) {
  if (variant === "sheet") return <div className="p-4">{children}</div>;
  return <div className="pp-card p-4">{children}</div>;
}

function SideButton({
  side,
  active,
  onClick,
  percent,
  price,
}: {
  side: MarketSide;
  active: boolean;
  onClick: () => void;
  percent: string;
  price: string | null | undefined;
}) {
  const isYes = side === "yes";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors",
        active
          ? isYes
            ? "border-[var(--color-yes)] bg-[var(--color-yes-dim)]/70"
            : "border-[var(--color-no)] bg-[var(--color-no-dim)]/70"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-wider",
            isYes ? "text-[var(--color-yes)]" : "text-[var(--color-no)]",
          )}
        >
          {/* Text label carries the meaning; colour only reinforces it. */}
          {active ? `✓ ${side}` : side}
        </span>
        <span
          className={cn(
            "tabular text-base font-bold",
            isYes ? "text-[var(--color-yes)]" : "text-[var(--color-no)]",
          )}
        >
          {percent}
        </span>
      </div>
      <p className="tabular mt-0.5 text-[11px] text-[var(--color-muted)]">
        {price ? `${formatPrice(price)} USDC` : "price unavailable"}
      </p>
    </button>
  );
}

function NotTradableState({ market }: { market: PantaMarket }) {
  const resolved = market.phase === "resolved";
  const cancelled = market.phase === "cancelled";
  const outcome = market.outcome?.toUpperCase() ?? null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text)]">
        {resolved ? "Market resolved" : cancelled ? "Market cancelled" : "Not open for primary buys"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
        {resolved
          ? outcome
            ? `Panta has resolved this market. The winning outcome is ${outcome}. Winning shares settle at 1 USDC each and can be claimed from your portfolio once Panta marks them claimable.`
            : "Panta has resolved this market. Winning shares can be claimed from your portfolio once Panta marks them claimable."
          : cancelled
            ? "This market was cancelled. No further trading is possible."
            : `This market is in the ${market.phase} phase. Panta's primary-buy endpoint only accepts orders during the primary phase, so no trade ticket is shown.`}
      </p>
      {resolved && (
        <Link href="/portfolio" className="pp-btn pp-btn-secondary mt-4 w-full">
          Open portfolio
        </Link>
      )}
      <PoweredByPanta variant="subtle" className="mt-4" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd className="text-right text-[var(--color-text)]">{children}</dd>
    </div>
  );
}
