import type { PantaCatalogTrade } from "@/lib/panta/types";
import { explorerTxUrl } from "@/lib/env";
import {
  UNAVAILABLE,
  formatShareBaseUnits,
  shareBaseUnitsToNumber,
  truncateAddress,
} from "@/lib/utils/format";
import { formatRelative } from "@/lib/utils/time";

/**
 * Panta market trade tape.
 *
 * Renders only fields the API actually returns. Where a row carries both YES
 * and NO amounts we show both rather than forcing it into a single side.
 */
export function RecentActivity({ trades }: { trades: PantaCatalogTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] px-6 py-10 text-center">
        <p className="text-sm font-medium text-[var(--color-text)]">No trades recorded yet</p>
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Panta has not returned any trades for this market.
        </p>
      </div>
    );
  }

  const sorted = [...trades].sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] text-left">
              <Th>Wallet</Th>
              <Th>Type</Th>
              <Th align="right">YES shares</Th>
              <Th align="right">NO shares</Th>
              <Th align="right">Fee</Th>
              <Th align="right">Time</Th>
              <Th align="right">Tx</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((trade, index) => (
              <tr
                key={trade.signature ?? `${trade.id ?? index}`}
                className="border-b border-[var(--color-border-subtle)]/60 last:border-0"
              >
                <Td>
                  <span className="font-mono text-xs text-[var(--color-muted)]">
                    {truncateAddress(trade.wallet)}
                  </span>
                </Td>
                <Td>
                  <SideTag trade={trade} />
                </Td>
                <Td align="right">
                  <span className="tabular text-[var(--color-yes)]">
                    {formatShareBaseUnits(trade.yesAmount)}
                  </span>
                </Td>
                <Td align="right">
                  <span className="tabular text-[var(--color-no)]">
                    {formatShareBaseUnits(trade.noAmount)}
                  </span>
                </Td>
                <Td align="right">
                  <span className="tabular text-[var(--color-muted)]">
                    {formatShareBaseUnits(trade.feePaid)}
                  </span>
                </Td>
                <Td align="right">
                  <span className="tabular text-[var(--color-muted)]">
                    {formatRelative(trade.blockTime)}
                  </span>
                </Td>
                <Td align="right">
                  {trade.signature ? (
                    <a
                      href={explorerTxUrl(trade.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[var(--color-accent)] hover:underline"
                    >
                      {truncateAddress(trade.signature, 4)}
                    </a>
                  ) : (
                    <span className="text-[var(--color-faint)]">{UNAVAILABLE}</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile rows: a desktop table squeezed to 360px is unreadable. */}
      <ul className="space-y-2 sm:hidden">
        {sorted.map((trade, index) => (
          <li
            key={trade.signature ?? `${trade.id ?? index}`}
            className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <SideTag trade={trade} />
              <span className="tabular text-xs text-[var(--color-muted)]">
                {formatRelative(trade.blockTime)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-mono text-[var(--color-muted)]">
                {truncateAddress(trade.wallet)}
              </span>
              <span className="tabular flex gap-3">
                <span className="text-[var(--color-yes)]">
                  Y {formatShareBaseUnits(trade.yesAmount)}
                </span>
                <span className="text-[var(--color-no)]">
                  N {formatShareBaseUnits(trade.noAmount)}
                </span>
              </span>
            </div>
            {trade.signature && (
              <a
                href={explorerTxUrl(trade.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-mono text-[11px] text-[var(--color-accent)]"
              >
                {truncateAddress(trade.signature, 6)} ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Derives the dominant side from the share amounts actually returned. */
function SideTag({ trade }: { trade: PantaCatalogTrade }) {
  const yes = shareBaseUnitsToNumber(trade.yesAmount) ?? 0;
  const no = shareBaseUnitsToNumber(trade.noAmount) ?? 0;
  const phase = trade.isPrimary ? "Primary" : "Secondary";

  let side: "YES" | "NO" | "MIXED" | null = null;
  if (yes > 0 && no > 0) side = "MIXED";
  else if (yes > 0) side = "YES";
  else if (no > 0) side = "NO";

  const tone =
    side === "YES"
      ? "border-[var(--color-yes)]/30 bg-[var(--color-yes-dim)]/50 text-[var(--color-yes)]"
      : side === "NO"
        ? "border-[var(--color-no)]/30 bg-[var(--color-no-dim)]/50 text-[var(--color-no)]"
        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-[var(--color-muted)]";

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-[var(--radius-chip)] border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
      >
        {side ?? "—"}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-faint)]">
        {phase}
      </span>
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className={`py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>
  );
}
