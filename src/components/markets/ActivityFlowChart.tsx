"use client";

import { useId, useMemo, useState } from "react";
import type { PantaCatalogTrade } from "@/lib/panta/types";
import { shareBaseUnitsToNumber } from "@/lib/utils/format";
import { formatDateShort } from "@/lib/utils/time";

/**
 * Cumulative share flow, drawn only from real Panta trade rows.
 *
 * Deliberately NOT a price chart. Panta's catalog trade rows carry share
 * quantities, a fee and a block time, they do not carry the USDC amount spent,
 * so a per-trade execution price cannot be derived from them. Inferring one
 * from `feePaid` would require assuming a fee rate, which would be fabricated
 * data. What IS honestly derivable is cumulative YES vs NO share demand over
 * time, which is what this renders.
 */

type Point = { t: number; yes: number; no: number };

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 26, left: 44 };

export function ActivityFlowChart({ trades }: { trades: PantaCatalogTrade[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<Point | null>(null);

  const points = useMemo<Point[]>(() => {
    const timed = trades
      .filter((t) => typeof t.blockTime === "number" && t.blockTime > 0)
      .sort((a, b) => (a.blockTime as number) - (b.blockTime as number));

    let yes = 0;
    let no = 0;
    return timed.map((trade) => {
      yes += shareBaseUnitsToNumber(trade.yesAmount) ?? 0;
      no += shareBaseUnitsToNumber(trade.noAmount) ?? 0;
      return { t: trade.blockTime as number, yes, no };
    });
  }, [trades]);

  // Two points is the minimum that can honestly be drawn as a trend.
  if (points.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] px-6 text-center">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">
            Not enough timestamped activity to chart
          </p>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--color-muted)]">
            Panta has returned {points.length === 0 ? "no" : "one"} timestamped trade for
            this market. A trend line is not drawn from a single observation.
          </p>
        </div>
      </div>
    );
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const spanT = Math.max(1, maxT - minT);
  const maxY = Math.max(
    points[points.length - 1].yes,
    points[points.length - 1].no,
    1,
  );

  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (t: number) => PADDING.left + ((t - minT) / spanT) * plotW;
  const y = (value: number) => PADDING.top + plotH - (value / maxY) * plotH;

  // Step-after path: share counts change discretely at each trade, so a
  // straight interpolation between points would imply movement that did not
  // happen. Stepping shows the actual observed jumps.
  const stepPath = (key: "yes" | "no") => {
    let d = `M ${x(points[0].t)} ${y(points[0][key])}`;
    for (let i = 1; i < points.length; i += 1) {
      d += ` L ${x(points[i].t)} ${y(points[i - 1][key])}`;
      d += ` L ${x(points[i].t)} ${y(points[i][key])}`;
    }
    return d;
  };

  const yesArea = `${stepPath("yes")} L ${x(maxT)} ${PADDING.top + plotH} L ${x(minT)} ${
    PADDING.top + plotH
  } Z`;

  const gridLines = [0, 0.5, 1].map((fraction) => ({
    value: maxY * fraction,
    y: PADDING.top + plotH - fraction * plotH,
  }));

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const targetT = minT + ((relX - PADDING.left) / plotW) * spanT;
    let closest = points[0];
    for (const point of points) {
      if (Math.abs(point.t - targetT) < Math.abs(closest.t - targetT)) closest = point;
    }
    setHover(closest);
  }

  const active = hover ?? points[points.length - 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full bg-[var(--color-yes)]"
            />
            YES shares
            <span className="tabular font-semibold text-[var(--color-yes)]">
              {active.yes.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-[var(--color-no)]" />
            NO shares
            <span className="tabular font-semibold text-[var(--color-no)]">
              {active.no.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
        <span className="tabular text-[11px] text-[var(--color-faint)]">
          {hover ? formatDateShort(active.t) : `${points.length} trades`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[220px] w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Cumulative share flow from ${points.length} Panta trades. YES ${active.yes.toFixed(
          2,
        )} shares, NO ${active.no.toFixed(2)} shares.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-yes)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-yes)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((line) => (
          <g key={line.y}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={line.y}
              y2={line.y}
              stroke="var(--color-border-subtle)"
              strokeWidth="1"
            />
            <text
              x={PADDING.left - 8}
              y={line.y + 3.5}
              textAnchor="end"
              className="tabular"
              fill="var(--color-faint)"
              fontSize="10"
            >
              {line.value >= 1000
                ? `${(line.value / 1000).toFixed(1)}k`
                : line.value.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={yesArea} fill={`url(#${gradientId})`} />
        <path
          d={stepPath("no")}
          fill="none"
          stroke="var(--color-no)"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d={stepPath("yes")}
          fill="none"
          stroke="var(--color-yes)"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />

        {hover && (
          <line
            x1={x(hover.t)}
            x2={x(hover.t)}
            y1={PADDING.top}
            y2={PADDING.top + plotH}
            stroke="var(--color-border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        <text
          x={PADDING.left}
          y={HEIGHT - 8}
          fill="var(--color-faint)"
          fontSize="10"
          className="tabular"
        >
          {formatDateShort(minT)}
        </text>
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 8}
          textAnchor="end"
          fill="var(--color-faint)"
          fontSize="10"
          className="tabular"
        >
          {formatDateShort(maxT)}
        </text>
      </svg>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-faint)]">
        Cumulative YES and NO shares acquired, built from Panta market trades. This is not
        a price chart: Panta trade rows report share quantities and fees, not the USDC
        spent, so execution prices cannot be derived from them.
      </p>
    </div>
  );
}
