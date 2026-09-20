"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import type { PantaTradeStatus } from "@/lib/panta/types";
import { Spinner } from "@/components/common/States";
import { cn } from "@/lib/utils/cn";

/**
 * Panta attribution status for a broadcast signature.
 *
 * Reporting a trade to Panta is only half of attribution, the other half is
 * being able to confirm Panta actually recorded it. Panta indexes
 * asynchronously, so a freshly-broadcast trade legitimately reads
 * `pending_attribution` for a while.
 *
 * This polls on a bounded, decelerating schedule (never indefinitely) and then
 * hands the user a manual re-check, rather than either hammering the endpoint
 * or silently leaving a pending state on screen forever.
 */

/** Deliberately finite and spread out: ~2s, 6s, 15s, 30s after mount. */
const POLL_SCHEDULE_MS = [2_000, 6_000, 15_000, 30_000];

type Display = {
  label: string;
  tone: "good" | "pending" | "bad" | "neutral";
  hint: string;
};

function describe(status: string | null, error: ApiErrorShape | null): Display {
  if (error) {
    return {
      label: "Check failed",
      tone: "neutral",
      hint: error.message,
    };
  }
  switch (status) {
    case "processed":
      return {
        label: "Attributed",
        tone: "good",
        hint: "Panta has recorded this trade against this integration.",
      };
    case "pending_attribution":
      return {
        label: "Pending",
        tone: "pending",
        hint: "Panta has seen the transaction on-chain but has not finished attributing it yet.",
      };
    case "failed":
      return {
        label: "Failed",
        tone: "bad",
        hint: "Panta could not validate this signature for attribution.",
      };
    case "unknown":
      return {
        label: "Not visible",
        tone: "neutral",
        hint: "Panta does not yet report this signature. It may still be propagating.",
      };
    default:
      return {
        label: "Not checked",
        tone: "neutral",
        hint: "Query Panta for this signature's attribution state.",
      };
  }
}

export function AttributionStatus({
  signature,
  initialStatus,
}: {
  signature: string;
  /** Status returned by the report call, used as the starting value. */
  initialStatus: string | null;
}) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [pollsDone, setPollsDone] = useState(0);

  // Guards against a poll landing after the component has gone away.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await apiFetch<PantaTradeStatus>(
        `/api/panta/trades/${encodeURIComponent(signature)}`,
      );
      if (!alive.current) return;
      setStatus(result.status ?? null);
    } catch (err) {
      if (!alive.current) return;
      setError(toErrorShape(err));
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [signature]);

  // Bounded auto-polling: stops as soon as the status settles, and always
  // stops once the schedule is exhausted.
  useEffect(() => {
    if (status === "processed" || status === "failed") return;
    if (pollsDone >= POLL_SCHEDULE_MS.length) return;

    const timer = setTimeout(() => {
      if (!alive.current) return;
      void check();
      setPollsDone((n) => n + 1);
    }, POLL_SCHEDULE_MS[pollsDone]);

    return () => clearTimeout(timer);
  }, [status, pollsDone, check]);

  const display = describe(status, error);
  const settled = status === "processed" || status === "failed";
  const autoPollExhausted = pollsDone >= POLL_SCHEDULE_MS.length;

  const toneClass =
    display.tone === "good"
      ? "border-[var(--color-yes)]/30 bg-[var(--color-yes-dim)]/40 text-[var(--color-yes)]"
      : display.tone === "pending"
        ? "border-[var(--color-warning)]/30 bg-[var(--color-warning-dim)]/40 text-[var(--color-warning)]"
        : display.tone === "bad"
          ? "border-[var(--color-no)]/30 bg-[var(--color-no-dim)]/40 text-[var(--color-no)]"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-[var(--color-muted)]";

  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
          Panta attribution
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            toneClass,
          )}
        >
          {checking && <Spinner className="h-2.5 w-2.5" />}
          {display.label}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
        {display.hint}
      </p>

      {/* Once auto-polling stops without settling, hand control to the user
          rather than leaving a stale pending state with no way forward. */}
      {!settled && (autoPollExhausted || error) && (
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="pp-btn pp-btn-secondary mt-2.5 w-full py-1.5 text-xs"
        >
          {checking ? (
            <>
              <Spinner /> Checking Panta…
            </>
          ) : (
            "Check attribution again"
          )}
        </button>
      )}
    </div>
  );
}
