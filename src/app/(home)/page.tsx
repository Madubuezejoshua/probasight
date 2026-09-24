import Link from "next/link";
import { MarketCard } from "@/components/markets/MarketCard";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { EmptyState, ErrorState } from "@/components/common/States";
import { IntelligenceShowcase } from "@/components/ai/IntelligenceShowcase";
import { HeroIntelligenceCard } from "@/components/home/HeroIntelligenceCard";
import {
  buildHeroCandidates,
  hasUsableName,
  selectHeroMarket,
} from "@/lib/home/hero-selection";
import { isLiveTradableMarket } from "@/lib/panta/live";
import { enrichMarketsWithPrices } from "@/lib/panta/enrich";
import { getMarket, getMarketTrades, listMarkets } from "@/lib/panta/markets";
import { toAppError } from "@/lib/panta/errors";
import type { ApiErrorShape } from "@/lib/client-api";
import type { PantaMarket } from "@/lib/panta/types";

export const dynamic = "force-dynamic";

const FEATURED_COUNT = 6;

/** Trade rows pulled for the hero card's signal strip. */
const HERO_TRADE_SAMPLE = 40;

/**
 * Reads market detail, retrying while it comes back with nothing filled in.
 *
 * Panta's detail endpoint intermittently answers HTTP 200 with every optional
 * field null: no pricing, no volume, nothing. Measured against the live API on
 * one market, three consecutive reads returned null, then real values, then
 * real values. Because the bad response is a 200 rather than an error code, the
 * transient retry inside `lib/panta/client` cannot see it.
 *
 * Bounded and read-only. A market that genuinely has no pricing, which is
 * normal for a cancelled or resolved one, simply returns after the attempts and
 * the card renders its honest "no pricing" state.
 */
const HERO_DETAIL_ATTEMPTS = 3;
const HERO_DETAIL_BACKOFF_MS = [150, 400];

async function getHeroDetail(marketId: string): Promise<PantaMarket> {
  // `fresh` because this read also decides whether the market is still open.
  let detail = await getMarket(marketId, { fresh: true });
  for (let attempt = 1; attempt < HERO_DETAIL_ATTEMPTS; attempt += 1) {
    if (detail.yesPrice !== null && detail.yesPrice !== undefined) return detail;
    await new Promise((resolve) =>
      setTimeout(resolve, HERO_DETAIL_BACKOFF_MS[attempt - 1] ?? 400),
    );
    detail = await getMarket(marketId, { fresh: true });
  }
  return detail;
}

export default async function HomePage() {
  let featured: PantaMarket[] = [];
  /** Every catalog row, enriched where we have it, for the hero draw. */
  let heroPool: PantaMarket[] = [];
  let anyLive = false;
  let error: ApiErrorShape | null = null;

  try {
    // Prefer tradable markets for the featured rail; fall back to the general
    // catalog if nothing is currently open. Pull a wider page than we display
    // so the curation below has something to work with.
    // Panta's `status` parameter does not filter by phase reliably against the
    // live catalog (status=primary returns cancelled and resolved rows too), so
    // the catalog is fetched unfiltered and liveness is decided here from the
    // real `phase`, `resolved` and `endTime` fields.
    // `fresh` skips the shared 30s cache: this response decides which markets
    // are still open, and a catalog page half a minute old can put a market
    // that has just closed into the hero.
    const catalog = await listMarkets({ limit: 50, fresh: true });
    const live = catalog.items.filter((m) => isLiveTradableMarket(m));
    anyLive = live.length > 0;
    const source = anyLive ? live : catalog.items;

    // Some live catalog rows carry neither a title nor a description. Those are
    // still real markets and remain listed on /markets, but a card that can only
    // say "Market AESrMoZx…" tells a visitor nothing, so named markets lead here.
    // This is ordering, not filtering: unnamed markets still fill remaining slots.
    const named = source.filter((m) => hasUsableName(m));
    const unnamed = source.filter((m) => !hasUsableName(m));
    const ordered = [...named, ...unnamed].slice(0, FEATURED_COUNT);

    featured = await enrichMarketsWithPrices(ordered, FEATURED_COUNT);

    // The hero draws from the WHOLE catalog, not just the six featured rows,
    // so the rotation pool is as wide as Panta allows. Enriched rows are
    // overlaid where we have them, which is the only place pricing exists at
    // this point and therefore the only way the pricing preference can bite.
    const enriched = new Map(featured.map((m) => [m.marketId, m]));
    heroPool = catalog.items.map((m) => enriched.get(m.marketId) ?? m);
  } catch (err) {
    const appError = toAppError(err);
    error = {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      retryable: appError.retryable,
    };
  }

  // The AI showcase invites the visitor to try a live market, so prefer one.
  const showcaseMarket =
    featured.find((m) => hasUsableName(m) && isLiveTradableMarket(m)) ??
    featured.find((m) => hasUsableName(m)) ??
    featured[0] ??
    null;

  // Hero card subject.
  //
  // Drawn at RANDOM from every live, readable market rather than taken with
  // `.find()`. The old find-first logic pinned whichever eligible row Panta
  // happened to return first, so one market could occupy the hero for days.
  //
  // There is deliberately no fallback to a closed market. The hero frames its
  // market as live, so showing a resolved, cancelled or expired one would be a
  // false claim; if nothing qualifies the card is simply not rendered.
  //
  // The tape drives the signal strip, and detail is re-read because catalog
  // rows carry no pricing. Detail is also the freshest liveness signal, so a
  // candidate that closed since the catalog read is discarded and the next one
  // tried, bounded by MAX_HERO_ATTEMPTS.
  const hero = await selectHeroMarket({
    candidates: buildHeroCandidates(heroPool, { random: Math.random }),
    fetchDetail: getHeroDetail,
    fetchTrades: async (marketId) =>
      (await getMarketTrades(marketId, HERO_TRADE_SAMPLE)).items,
  });

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      {/* Compact hero. Deliberately not a full-viewport marketing panel.
          Two columns from lg up, roughly 55/45: copy left, live market card
          right. Below lg it collapses to one column and the card stacks under
          the buttons, so nothing is hidden at any width. */}
      <section className="border-b border-[var(--color-border-subtle)] py-10 sm:py-14">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[55fr_45fr] lg:gap-10">
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
              Real-time Panta market intelligence, AI analysis, and on-chain trading in
              one terminal.
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

          {/* Right column. Only ever a live market. When nothing is open the
              card is replaced by a one-line honest note rather than by a
              closed market dressed up as live. */}
          {hero ? (
            <div className="w-full lg:max-w-[520px] lg:justify-self-end">
              <HeroIntelligenceCard
                market={hero.market}
                trades={hero.trades}
                tradesUnavailable={hero.tradesUnavailable}
              />
            </div>
          ) : error ? null : (
            <div className="w-full lg:max-w-[520px] lg:justify-self-end">
              <p className="pp-card px-4 py-3 text-sm text-[var(--color-muted)]">
                No live market available right now.{" "}
                <Link
                  href="/markets"
                  className="font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-bright)]"
                >
                  Browse the full catalog
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Featured markets: the main visual of the page, all real Panta rows. */}
      <section className="py-8 sm:py-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Trending markets
            </h2>
            {/* The rail falls back to closed markets when nothing is open, so
                the wording has to follow the data rather than always claiming
                "live". */}
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {anyLive
                ? "Live from the Panta catalog, with current YES/NO pricing."
                : "From the Panta catalog. No markets are open for trading right now."}
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
              ProbaSight never holds your keys or your funds. Every on-chain action is
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
