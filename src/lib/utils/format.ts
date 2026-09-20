/**
 * Formatting helpers.
 *
 * Every function here returns an explicit unavailable marker rather than a
 * substituted value when the upstream field is missing. A truthful gap is
 * always preferable to an invented number.
 */

export const UNAVAILABLE = "N/A";

const USDC_DECIMALS = 6;
const BASE_UNIT = 1_000_000;

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Panta returns creation fees and creator-fee balances as USDC base-unit
 * integer strings (6 decimals): "50000000" -> "50.00 USDC".
 */
export function formatUsdcBaseUnits(value: unknown, withSymbol = true): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  const human = n / BASE_UNIT;
  const text = human.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: USDC_DECIMALS,
  });
  return withSymbol ? `${text} USDC` : text;
}

/**
 * Catalog trade share amounts and fees are stored as 1e6 base units, matching
 * the official Panta playground helper `formatShareBase`.
 */
export function formatShareBaseUnits(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  if (n === 0) return "0";
  return (n / BASE_UNIT).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function shareBaseUnitsToNumber(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n === null ? null : n / BASE_UNIT;
}

/** Volume fields such as volumeUsdc are already human decimal strings. */
export function formatUsdcDecimal(value: unknown, withSymbol = true): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  const text = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${text} USDC` : text;
}

/** Compact volume for dense cards. */
export function formatCompactUsdc(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  if (n < 1000) {
    return `${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USDC`;
  }
  return `${n.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })} USDC`;
}

/** Share quantities from /positions/ are human-readable decimal strings. */
export function formatShares(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

/**
 * Panta spot prices are decimal USDC per share, e.g. "0.485866425".
 * In the primary phase this is the acquisition price per share.
 */
export function formatPrice(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  return n.toFixed(3);
}

/**
 * A YES/NO share price in a 0-1 USDC market reads naturally as an implied
 * percentage. Returns null when there is no usable price, so callers can show
 * an honest empty state instead of a placeholder percentage.
 */
export function priceToImpliedPercent(value: unknown): number | null {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  if (n < 0 || n > 1) return null;
  return n * 100;
}

export function formatImpliedPercent(value: unknown): string {
  const pct = priceToImpliedPercent(value);
  if (pct === null) return UNAVAILABLE;
  return `${pct.toFixed(0)}%`;
}

export function truncateAddress(address: string | null | undefined, chars = 4): string {
  if (!address) return UNAVAILABLE;
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatNumber(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return UNAVAILABLE;
  return n.toLocaleString("en-US");
}

/** Parses a user-entered USDC amount. Positive finite values only. */
export function parseUsdcAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Normalises a user amount to the decimal string Panta expects, e.g. "20.00". */
export function toUsdcAmountString(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Estimated open-position value, per Panta docs:
 *   open market       -> shares x matching side spot price
 *   resolved winner   -> approximately 1 USDC per share
 *   resolved loser    -> 0
 * Returns null when no usable reference exists, so the UI shows
 * "Value unavailable" rather than a fabricated number.
 */
export function estimatePositionValueUsdc(input: {
  shares: string | number | null | undefined;
  side: "yes" | "no";
  phase: string;
  outcome?: string | null;
  yesPrice?: string | null;
  noPrice?: string | null;
}): number | null {
  const shares = toFiniteNumber(input.shares);
  if (shares === null) return null;

  const outcome = input.outcome?.toLowerCase() ?? null;
  if (input.phase === "resolved" && outcome) {
    return outcome === input.side ? shares : 0;
  }
  if (input.phase === "cancelled") return null;

  const price = toFiniteNumber(input.side === "yes" ? input.yesPrice : input.noPrice);
  if (price === null) return null;
  return shares * price;
}
