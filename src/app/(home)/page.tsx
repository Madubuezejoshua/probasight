import Link from "next/link";
import { MarketCard } from "@/components/markets/MarketCard";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { EmptyState, ErrorState } from "@/components/common/States";
import { IntelligenceShowcase } from "@/components/ai/IntelligenceShowcase";
import { HeroIntelligenceCard } from "@/components/home/HeroIntelligenceCard";
import { enrichMarketsWithPrices } from "@/lib/panta/enrich";
import { getMarket, getMarketTrades, listMarkets } from "@/lib/panta/markets";
import { toAppError } from "@/lib/panta/errors";
import type { ApiErrorShape } from "@/lib/client-api";
import type { PantaCatalogTrade, PantaMarket } from "@/lib/panta/types";

export const dynamic = "force-dynamic";

const FEATURED_COUNT = 6;

/** Trade rows pulled for the hero card's signal strip. */
const HERO_TRADE_SAMPLE = 40;

/** A market a visitor can actually read: it has a title or a description. */
function hasUsableName(market: PantaMarket): boolean {
  return Boolean(market.title?.trim() || market.description?.trim());
}

/** Both sides priced. Panta returns pricing on detail, not on catalog rows. */
function hasPricing(market: PantaMarket): boolean {
  return (
    market.yesPrice !== null &&
    market.yesPrice !== undefined &&
    market.noPrice !== null &&
    market.noPrice !== undefined
  );
}

/**
 * Overlays `next` onto `base`, ignoring keys whose new value is null,
 * undefined or an empty string.
 *
 * Panta's detail and catalog rows are each authoritative for different fields:
 * detail carries YES/NO pricing that list rows never have, while a list row can
 * carry a volume that the detail row returns as null. Preferring whichever
 * response actually has a value keeps both rather than letting the later one
 * blank out the earlier.
 */
function mergeDefined(base: PantaMarket, next: PantaMarket): PantaMarket {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value;
    }
  }
  return merged as PantaMarket;
}

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
  let detail = await getMarket(marketId);
  for (let attempt = 1; attempt < HERO_DETAIL_ATTEMPTS; attempt += 1) {
    if (detail.yesPrice !== null && detail.yesPrice !== undefined) return detail;
    await new Promise((resolve) =>
      setTimeout(resolve, HERO_DETAIL_BACKOFF_MS[attempt - 1] ?? 400),
    );
    detail = await getMarket(marketId);
  }
  return detail;
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

  // Hero card subject, in order of preference: readable and tradable and
  // already priced, then readable and tradable, then merely readable.
  //
  // Pricing is a PREFERENCE, never a requirement. The enrichment that supplies
  // it is best-effort and drops out when Panta's detail endpoint is having a
  // bad minute, so requiring it made the entire card disappear and left the
  // hero lopsided. Preferring it means the card usually leads with a fully
  // populated market, and otherwise still renders with its honest
  // "no pricing right now" state.
  let heroMarket =
    featured.find((m) => hasUsableName(m) && m.phase === "primary" && hasPricing(m)) ??
    featured.find((m) => hasUsableName(m) && m.phase === "primary") ??
    featured.find((m) => hasUsableName(m)) ??
    null;

  // The tape drives the signal strip. Detail is re-read here because catalog
  // rows carry no pricing and the list enrichment may have missed it; the
  // detail row is authoritative. Neither failure may take down the hero, so
  // each degrades to an explicit state on the card.
  let heroTrades: PantaCatalogTrade[] = [];
  let heroTradesUnavailable = false;
  if (heroMarket) {
    const [detail, tape] = await Promise.allSettled([
      getHeroDetail(heroMarket.marketId),
      getMarketTrades(heroMarket.marketId, HERO_TRADE_SAMPLE),
    ]);
    if (detail.status === "fulfilled") {
      // Merge field by field, keeping the catalog value wherever detail has
      // none. A plain spread lets a null/undefined detail field blank out a
      // value the list row did have, which wiped volume off the card.
      heroMarket = mergeDefined(heroMarket, detail.value);
    }
    if (tape.status === "fulfilled") {
      heroTrades = tape.value.items;
    } else {
      heroTradesUnavailable = true;
    }
  }

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

          {/* Right column. Rendered only when Panta actually gave us a market
              worth showing; the hero simply returns to one column otherwise
              rather than displaying an empty shell. */}
          {heroMarket ? (
            <div className="w-full lg:max-w-[520px] lg:justify-self-end">
              <HeroIntelligenceCard
                market={heroMarket}
                trades={heroTrades}
                tradesUnavailable={heroTradesUnavailable}
              />
            </div>
          ) : null}
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
