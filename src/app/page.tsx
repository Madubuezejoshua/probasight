import Link from "next/link";
import { MarketCard } from "@/components/markets/MarketCard";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { EmptyState, ErrorState } from "@/components/common/States";
import { IntelligenceShowcase } from "@/components/ai/IntelligenceShowcase";
import { enrichMarketsWithPrices } from "@/lib/panta/enrich";
import { listMarkets } from "@/lib/panta/markets";
import { toAppError } from "@/lib/panta/errors";
import type { ApiErrorShape } from "@/lib/client-api";
import type { PantaMarket } from "@/lib/panta/types";

export const dynamic = "force-dynamic";

const FEATURED_COUNT = 6;

/** A market a visitor can actually read: it has a title or a description. */
function hasUsableName(market: PantaMarket): boolean {
  return Boolean(market.title?.trim() || market.description?.trim());
}

export default async function HomePage() {
  let featured: PantaMarket[] = [];
  let error: ApiErrorShape | null = null;

  try {
    // Prefer tradable markets for the featured rail; fall back to the general
    // catalog if the primary phase is empty right now. Pull a wider page than we
    // display so the curation below has something to work with.
    // Panta's `status` parameter does not filter by phase reliably against the
    // live catalog (status=primary returns cancelled and resolved rows too), so
    // the catalog is fetched unfiltered and phase is applied here on the real
    // `phase` field. Falls back to any phase if nothing is currently tradable.
    const catalog = await listMarkets({ limit: 50 });
    const tradable = catalog.items.filter((m) => m.phase === "primary");
    const source = tradable.length > 0 ? tradable : catalog.items;

    // Some live catalog rows carry neither a title nor a description. Those are
    // still real markets and remain listed on /markets, but a card that can only
    // say "Market AESrMoZx…" tells a visitor nothing, so named markets lead here.
    // This is ordering, not filtering: unnamed markets still fill remaining slots.
    const named = source.filter((m) => hasUsableName(m));
    const unnamed = source.filter((m) => !hasUsableName(m));
    const ordered = [...named, ...unnamed].slice(0, FEATURED_COUNT);

    featured = await enrichMarketsWithPrices(ordered, FEATURED_COUNT);
  } catch (err) {
    const appError = toAppError(err);
    error = {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      retryable: appError.retryable,
    };
  }

  // The AI showcase links to one real market, so pick one a visitor can read.
  const showcaseMarket = featured.find((m) => hasUsableName(m)) ?? featured[0] ?? null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      {/* Compact hero. Deliberately not a full-viewport marketing panel. */}
      <section className="border-b border-[var(--color-border-subtle)] py-10 sm:py-14">
        <div className="max-w-3xl">
          <div className="pp-chip mb-4 normal-case">
            <span
              aria-hidden
              className="pp-live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
            />
            Prediction-market intelligence terminal
          </div>
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Prediction markets,
            <br />
            <span className="text-[var(--color-accent)]">understood.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
            Real-time Panta market intelligence, AI analysis, and on-chain trading in one
            terminal.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/markets" className="pp-btn pp-btn-primary px-5">
              Explore Markets
            </Link>
            <Link href="/create" className="pp-btn pp-btn-secondary px-5">
              Create Market
            </Link>
            <PoweredByPanta variant="subtle" className="ml-1" />
          </div>
        </div>
      </section>

      {/* Featured markets: the main visual of the page, all real Panta rows. */}
      <section className="py-8 sm:py-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Trending markets
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Live from the Panta catalog, with current YES/NO pricing.
            </p>
          </div>
          <Link
            href="/markets"
            className="text-sm font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-bright)]"
          >
            All markets →
          </Link>
        </div>

        {error ? (
          <ErrorState error={error} />
        ) : featured.length === 0 ? (
          <EmptyState
            title="No markets available right now"
            description="Panta returned an empty catalog for this request. This is the live upstream state, not a loading failure."
            action={
              <Link href="/markets" className="pp-btn pp-btn-secondary">
                Open markets
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((market) => (
              <MarketCard key={market.marketId} market={market} />
            ))}
          </div>
        )}
      </section>

      {/* Market intelligence showcase. */}
      <section className="py-8 sm:py-10">
        <IntelligenceShowcase market={showcaseMarket} />
      </section>

      {/* How it works. */}
      <section className="border-t border-[var(--color-border-subtle)] py-10">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">How it works</h2>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StepCard
            step="01"
            title="Discover"
            body="Browse the live Panta catalog by category and phase with readable YES/NO pricing."
          />
          <StepCard
            step="02"
            title="Analyse"
            body="Generate a structured, balanced read of the market from its own Panta data and trade tape."
          />
          <StepCard
            step="03"
            title="Trade"
            body="Quote, build, sign in your own wallet, broadcast on Solana, and report the trade to Panta."
          />
          <StepCard
            step="04"
            title="Track & claim"
            body="Follow positions and activity, then claim winnings or creator fees when Panta marks them eligible."
          />
        </div>
      </section>

      <section className="border-t border-[var(--color-border-subtle)] py-12">
        <div className="pp-panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Non-custodial by construction
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
              Panta Pulse never holds your keys or your funds. Every on-chain action is
              built by Panta, signed by your wallet, and broadcast to Solana with your
              explicit approval.
            </p>
          </div>
          <Link href="/markets" className="pp-btn pp-btn-primary shrink-0 px-5">
            Start exploring
          </Link>
        </div>
      </section>
    </div>
  );
}

function StepCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="pp-card p-5">
      <span className="tabular text-[11px] font-bold tracking-widest text-[var(--color-accent)]">
        {step}
      </span>
      <h3 className="mt-2 text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}
