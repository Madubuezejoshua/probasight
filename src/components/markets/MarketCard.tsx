import Link from "next/link";
import type { PantaMarket } from "@/lib/panta/types";
import { marketTitle } from "@/lib/panta/display";
import {
  UNAVAILABLE,
  formatCompactUsdc,
  formatImpliedPercent,
  formatPrice,
} from "@/lib/utils/format";
import { formatTimeUntil } from "@/lib/utils/time";
import { CategoryChip, MarketImage, PhaseBadge } from "./MarketMeta";

/**
 * Discovery card.
 *
 * Prices render only when Panta actually returned them. `GET /markets/` leaves
 * them null by design, so a card without enriched detail shows an explicit
 * "live price on market page" state rather than a fabricated number.
 */
export function MarketCard({ market }: { market: PantaMarket }) {
  const hasPrices =
    market.yesPrice !== null &&
    market.yesPrice !== undefined &&
    market.noPrice !== null &&
    market.noPrice !== undefined;

  const isTradable = market.phase === "primary";
  const closeLabel = formatTimeUntil(market.endTime);

  return (
    <Link
      href={`/markets/${market.marketId}`}
      className="pp-card group flex flex-col p-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
    >
      <div className="flex items-start gap-3">
        <MarketImage images={market.images} title={marketTitle(market)} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)]">
            {marketTitle(market)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <CategoryChip category={market.category} />
            <PhaseBadge phase={market.phase} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {hasPrices ? (
          <div className="grid grid-cols-2 gap-2">
            <OutcomeTile
              label="YES"
              percent={formatImpliedPercent(market.yesPrice)}
              price={formatPrice(market.yesPrice)}
              tone="yes"
            />
            <OutcomeTile
              label="NO"
              percent={formatImpliedPercent(market.noPrice)}
              price={formatPrice(market.noPrice)}
              tone="no"
            />
          </div>
        ) : (
          <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] px-3 py-3 text-center">
            <p className="text-xs text-[var(--color-muted)]">
              {market.phase === "resolved"
                ? "Market resolved — see settlement"
                : market.phase === "cancelled"
                  ? "Market cancelled"
                  : "Live price available on the market page"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-muted)]">
        <span className="tabular">
          Vol {market.volumeUsdc ? formatCompactUsdc(market.volumeUsdc) : UNAVAILABLE}
        </span>
        <span className="tabular">{isTradable ? closeLabel : market.status || closeLabel}</span>
      </div>
    </Link>
  );
}

function OutcomeTile({
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
  const toneClass =
    tone === "yes"
      ? "border-[var(--color-yes)]/25 bg-[var(--color-yes-dim)]/45"
      : "border-[var(--color-no)]/25 bg-[var(--color-no-dim)]/45";
  const textClass = tone === "yes" ? "text-[var(--color-yes)]" : "text-[var(--color-no)]";

  return (
    <div className={`rounded-[var(--radius-control)] border px-3 py-2 ${toneClass}`}>
      <div className="flex items-baseline justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${textClass}`}>
          {label}
        </span>
        <span className={`tabular text-lg font-bold leading-none ${textClass}`}>
          {percent}
        </span>
      </div>
      <p className="tabular mt-1 text-[11px] text-[var(--color-muted)]">{price} USDC</p>
    </div>
  );
}
