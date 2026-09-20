/**
 * Display helpers for catalog rows.
 *
 * The live mainnet catalog returns `title` as an EMPTY STRING on every market,
 * the human-readable question actually lives in `description`. (The sandbox
 * catalog does populate `title`, which is why this only shows up against a
 * `pk_live_` key.) Rendering `title` directly leaves every card, heading and
 * portfolio row blank, so every surface goes through here instead.
 */

const MAX_HEADING_CHARS = 180;

/**
 * The subset of a catalog row these helpers need.
 *
 * Deliberately looser than `PantaMarket`: the declared type says `title` is a
 * required string, but live rows arrive with it empty, and defensive callers
 * may hold null. Accepting that here keeps the checks in one place.
 */
export type NameableMarket = {
  title?: string | null;
  description?: string | null;
  marketId?: string | null;
};

/** True when a catalog string is present and not just whitespace. */
function usable(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Best available human-readable name for a market.
 *
 * Order: title -> description -> a truncated market id, so a row is never
 * rendered nameless. Never returns an empty string.
 */
export function marketTitle(market: NameableMarket): string {
  if (usable(market.title)) return market.title.trim();

  if (usable(market.description)) {
    const text = market.description.trim();
    if (text.length <= MAX_HEADING_CHARS) return text;
    // Cut on a word boundary so a heading never ends mid-word.
    const clipped = text.slice(0, MAX_HEADING_CHARS);
    const lastSpace = clipped.lastIndexOf(" ");
    return `${(lastSpace > 60 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
  }

  return market.marketId ? `Market ${market.marketId.slice(0, 8)}…` : "Untitled market";
}

/**
 * Supporting text to show under the heading.
 *
 * Returns null when the description is already being used as the heading, so
 * the same sentence is never printed twice.
 */
export function marketSubtitle(market: NameableMarket): string | null {
  if (!usable(market.description)) return null;
  if (!usable(market.title)) return null; // description is the heading
  return market.description.trim();
}

/** Single character for the image-fallback monogram. */
export function marketInitial(market: NameableMarket): string {
  const name = marketTitle(market).trim();
  const first = name.charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(first) ? first : "?";
}
