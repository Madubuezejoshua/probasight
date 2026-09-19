import { UNAVAILABLE } from "./format";

/**
 * Panta timestamp value as it actually arrives on the wire.
 *
 * The docs describe `startTime` / `endTime` / `resolutionTime` as integer Unix
 * seconds, but the live API returns ISO-8601 strings on catalog reads (verified
 * against production: `"2026-01-01T00:00:00Z"`). Both forms are accepted here
 * rather than trusting one and silently rendering "—" for the other.
 *
 * Note the asymmetry: market CREATION still sends integer Unix seconds, which is
 * what the create endpoint documents and accepts.
 */
export type PantaTimestamp = number | string | null | undefined;

export function unixToDate(value: PantaTimestamp): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return new Date(value * 1000);
  }

  // Numeric string, e.g. "1767225600".
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0 && /^\d+$/.test(value.trim())) {
    return new Date(asNumber * 1000);
  }

  // ISO-8601 string.
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

export function formatDateTime(unixSeconds: PantaTimestamp): string {
  const date = unixToDate(unixSeconds);
  if (!date) return UNAVAILABLE;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateShort(unixSeconds: PantaTimestamp): string {
  const date = unixToDate(unixSeconds);
  if (!date) return UNAVAILABLE;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Relative time for trade tapes, e.g. "3m ago". */
export function formatRelative(
  unixSeconds: PantaTimestamp,
  now = Date.now(),
): string {
  const date = unixToDate(unixSeconds);
  if (!date) return UNAVAILABLE;
  const diffSeconds = Math.round((now - date.getTime()) / 1000);
  const future = diffSeconds < 0;
  const abs = Math.abs(diffSeconds);

  if (abs >= 2592000) return formatDateShort(unixSeconds);

  let text: string;
  if (abs < 60) text = `${abs}s`;
  else if (abs < 3600) text = `${Math.floor(abs / 60)}m`;
  else if (abs < 86400) text = `${Math.floor(abs / 3600)}h`;
  else text = `${Math.floor(abs / 86400)}d`;

  return future ? `in ${text}` : `${text} ago`;
}

/** Countdown to market close, used on cards and the market header. */
export function formatTimeUntil(
  unixSeconds: PantaTimestamp,
  now = Date.now(),
): string {
  const date = unixToDate(unixSeconds);
  if (!date) return UNAVAILABLE;
  const diff = date.getTime() - now;
  if (diff <= 0) return "Closed";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d left`;
  return formatDateShort(unixSeconds);
}

export function isPast(unixSeconds: PantaTimestamp, now = Date.now()): boolean {
  const date = unixToDate(unixSeconds);
  if (!date) return false;
  return date.getTime() < now;
}

/** ISO-8601 expiry string (quote/build session) to remaining whole seconds. */
export function secondsUntilIso(
  iso: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - now) / 1000);
}

/** Converts a datetime-local input value to Unix seconds. */
export function datetimeLocalToUnix(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/** Converts Unix seconds to a datetime-local input value in local time. */
export function unixToDatetimeLocal(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Panta requires startTime at least minimumStartDelay ahead of now (typically 3600s). */
export const MINIMUM_START_DELAY_SECONDS = 3600;
