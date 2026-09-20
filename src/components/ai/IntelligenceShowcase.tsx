import Link from "next/link";
import type { PantaMarket } from "@/lib/panta/types";
import { marketTitle } from "@/lib/panta/display";
import { MarketImage } from "@/components/markets/MarketMeta";

/**
 * Homepage preview of AI Market Intelligence.
 *
 * This deliberately shows the STRUCTURE of the analysis and what each section
 * is derived from. It never renders sample analysis text, because any such text
 * would be fabricated market commentary. Groq is only ever called on demand
 * from a market page.
 */

const SECTIONS = [
  {
    title: "Summary",
    body: "What the market asks and where it stands, from the live Panta catalog row.",
  },
  {
    title: "Current market view",
    body: "What the current YES/NO share pricing and market phase imply, in plain terms.",
  },
  {
    title: "Activity analysis",
    body: "Participation and YES vs NO share flow read from the Panta trade tape.",
  },
  {
    title: "YES case / NO case",
    body: "Balanced framings of what each side requires under the market's own resolution rule.",
  },
  {
    title: "Key uncertainties",
    body: "What would actually decide the outcome, and what the data cannot tell you.",
  },
  {
    title: "Data limitations",
    body: "An explicit list of what is missing or unavailable in the snapshot analysed.",
  },
];

export function IntelligenceShowcase({ market }: { market: PantaMarket | null }) {
  return (
    <div className="pp-card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="border-b border-[var(--color-border-subtle)] p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="pp-chip normal-case">
            <span aria-hidden>◆</span> AI Market Intelligence
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
            Structured research, not a chatbot
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Every analysis is generated on demand from one thing: a live snapshot of that
            market&apos;s own Panta data: catalog fields, phase, YES/NO pricing, timing,
            resolution metadata and the recent trade tape.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            There is no news feed and no web search behind it. The model is instructed to
            state what the data cannot support rather than fill the gap, to present both
            sides, and never to recommend a trade.
          </p>

          {market ? (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Try it on a live market
              </p>
              <Link
                href={`/markets/${market.marketId}`}
                className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-3 transition-colors hover:border-[var(--color-accent-dim)]"
              >
                <MarketImage images={market.images} title={marketTitle(market)} size={36} />
                <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-[var(--color-text)]">
                  {marketTitle(market)}
                </span>
                <span aria-hidden className="shrink-0 text-[var(--color-accent)]">
                  →
                </span>
              </Link>
            </div>
          ) : (
            <p className="mt-6 text-sm text-[var(--color-muted)]">
              Open any market to run an analysis.
            </p>
          )}
        </div>

        <div className="bg-[var(--color-surface-2)]/40 p-6 lg:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
            What every analysis returns
          </p>
          <ul className="mt-4 space-y-3">
            {SECTIONS.map((section, index) => (
              <li key={section.title} className="flex gap-3">
                <span className="tabular mt-0.5 shrink-0 text-[11px] font-bold text-[var(--color-accent)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {section.title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
                    {section.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
