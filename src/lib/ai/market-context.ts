import "server-only";

import type { PantaCatalogTrade, PantaMarket } from "@/lib/panta/types";
import { shareBaseUnitsToNumber } from "@/lib/utils/format";
import { unixToDate, type PantaTimestamp } from "@/lib/utils/time";

/**
 * Whether this market states what it is actually about.
 *
 * Note the two different shapes Panta returns: `GET /markets/` (list) sends
 * `title: ""` for most rows, while `GET /markets/{id}/` (detail) usually has
 * the real question. This check runs against detail, so it only refuses the
 * markets that are genuinely empty in both — still a meaningful share of the
 * live catalog.
 *
 * Refusing matters because a model handed a market with no question is free to
 * infer one from the category, region or oracle feed names, and would present
 * that inference as the market's subject. There is nothing truthful to say
 * about a market whose question is unknown, so nothing is said.
 */
export function hasAnalysableQuestion(market: PantaMarket): boolean {
  return Boolean(market.title?.trim() || market.description?.trim());
}

/**
 * Builds the analysis context.
 *
 * Only real Panta fields go in. Missing values are passed through as the
 * literal string "unavailable" so the model is told what it does NOT know
 * rather than being left to guess.
 */

export type MarketContext = {
  market: Record<string, string>;
  activity: {
    tradeCount: number;
    window: string;
    totalYesSharesBought: string;
    totalNoSharesBought: string;
    uniqueWallets: number;
    primaryTradeCount: number;
    notes: string[];
  };
};

const NA = "unavailable";

function orNA(value: unknown): string {
  if (value === null || value === undefined || value === "") return NA;
  return String(value);
}

/**
 * Normalises a catalog timestamp to ISO for the model.
 *
 * Reuses the shared parser so it handles both wire formats Panta actually
 * emits (documented Unix integers and the ISO strings the live catalog
 * returns). An unparseable value becomes "unavailable" rather than a bogus
 * 1970 date, so the model is never handed a fabricated timestamp.
 */
function isoOrNA(value: PantaTimestamp): string {
  const date = unixToDate(value);
  return date ? date.toISOString() : NA;
}

export function buildMarketContext(
  market: PantaMarket,
  trades: PantaCatalogTrade[],
): MarketContext {
  const notes: string[] = [];

  const yesPriceKnown = market.yesPrice !== null && market.yesPrice !== undefined;
  if (!yesPriceKnown) {
    notes.push(
      "Panta did not return spot YES/NO prices for this market; price-based inference is not possible.",
    );
  }

  let totalYes = 0;
  let totalNo = 0;
  let primaryCount = 0;
  const wallets = new Set<string>();
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const trade of trades) {
    const yes = shareBaseUnitsToNumber(trade.yesAmount) ?? 0;
    const no = shareBaseUnitsToNumber(trade.noAmount) ?? 0;
    totalYes += yes;
    totalNo += no;
    if (trade.isPrimary) primaryCount += 1;
    if (trade.wallet) wallets.add(trade.wallet);
    if (typeof trade.blockTime === "number" && trade.blockTime > 0) {
      earliest = earliest === null ? trade.blockTime : Math.min(earliest, trade.blockTime);
      latest = latest === null ? trade.blockTime : Math.max(latest, trade.blockTime);
    }
  }

  if (trades.length === 0) {
    notes.push("Panta returned no trade tape rows for this market.");
  } else {
    notes.push(
      "Trade rows report share quantities and fees only. They do not include the USDC amount spent, so per-trade execution prices cannot be derived and are not provided.",
    );
  }

  const window =
    earliest !== null && latest !== null
      ? `${new Date(earliest * 1000).toISOString()} to ${new Date(latest * 1000).toISOString()}`
      : NA;

  return {
    market: {
      marketId: market.marketId,
      // Raw values only. Never pass a synthesised display name here: a
      // placeholder like "Market AESrMoZx..." reads to the model as a real
      // title and invites it to invent matching context.
      title: orNA(market.title),
      description: orNA(market.description),
      category: orNA(market.category),
      phase: orNA(market.phase),
      status: orNA(market.status),
      marketType: orNA(market.marketType),
      region: orNA(market.region),
      resolved: orNA(market.resolved),
      outcome: orNA(market.outcome),
      resolutionCriteriaOracle: orNA(market.oracle),
      yesPriceUsdcPerShare: orNA(market.yesPrice),
      noPriceUsdcPerShare: orNA(market.noPrice),
      primaryYesPrice: orNA(market.primaryYesPrice),
      primaryNoPrice: orNA(market.primaryNoPrice),
      secondaryYesPrice: orNA(market.secondaryYesPrice),
      secondaryNoPrice: orNA(market.secondaryNoPrice),
      volumeUsdc: orNA(market.volumeUsdc),
      startTimeUtc: isoOrNA(market.startTime),
      endTimeUtc: isoOrNA(market.endTime),
      resolutionTimeUtc: isoOrNA(market.resolutionTime),
      nowUtc: new Date().toISOString(),
    },
    activity: {
      tradeCount: trades.length,
      window,
      totalYesSharesBought: trades.length ? totalYes.toFixed(4) : NA,
      totalNoSharesBought: trades.length ? totalNo.toFixed(4) : NA,
      uniqueWallets: wallets.size,
      primaryTradeCount: primaryCount,
      notes,
    },
  };
}
