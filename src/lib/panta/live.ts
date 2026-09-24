import { unixToDate } from "@/lib/utils/time";
import type { PantaMarket } from "./types";

/**
 * Is this market actually open for trading right now?
 *
 * The homepage hero presents one market as live, so "probably still open" is
 * not good enough: a resolved or expired market sitting in the hero tells a
 * visitor something false about the product. Every signal Panta gives us is
 * checked, and anything ambiguous counts as NOT live.
 *
 * Note that `phase === "primary"` alone is not sufficient. A market keeps that
 * phase past its own `endTime` until Panta settles it, so the clock has to be
 * checked separately.
 *
 * Timestamps are parsed with `unixToDate`, which already handles both forms
 * Panta returns in practice: integer Unix seconds as documented, and ISO-8601
 * strings as the live catalog actually sends. A timestamp that cannot be parsed
 * is treated as "no information" rather than as expired, because rejecting on
 * an unparseable field would empty the hero over a formatting change.
 */

/** Values of the free-text `status` field that mean the market is not tradable. */
const CLOSED_STATUSES = new Set(["resolved", "cancelled", "canceled", "closed", "settled"]);

export function isLiveTradableMarket(
  market: Pick<PantaMarket, "phase" | "resolved" | "endTime" | "status">,
  now: number = Date.now(),
): boolean {
  if (market.phase !== "primary") return false;

  // `resolved` is authoritative even when `phase` has not caught up yet.
  if (market.resolved === true) return false;

  if (typeof market.status === "string" && CLOSED_STATUSES.has(market.status.trim().toLowerCase())) {
    return false;
  }

  const endsAt = unixToDate(market.endTime);
  if (endsAt && endsAt.getTime() <= now) return false;

  return true;
}
