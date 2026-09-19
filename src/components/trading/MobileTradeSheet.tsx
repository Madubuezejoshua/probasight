"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PantaMarket } from "@/lib/panta/types";
import { marketTitle } from "@/lib/panta/display";
import { formatImpliedPercent } from "@/lib/utils/format";
import { TradePanel } from "./TradePanel";
import { cn } from "@/lib/utils/cn";

/**
 * Mobile trading: a sticky action bar that opens a bottom sheet.
 *
 * The sheet is a modal dialog with focus containment, Escape-to-close, scroll
 * lock, and a safe-area-aware footer so it clears the iOS home indicator.
 */
export function MobileTradeSheet({ market }: { market: PantaMarket }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;

      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    // Move focus into the sheet once it has painted.
    const timer = setTimeout(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>("button, input, a[href]")
        ?.focus();
    }, 60);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [open, close]);

  const tradable = market.phase === "primary";

  const bar = (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg)]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      <div className="flex items-center gap-3">
        {tradable && (
          <div className="flex min-w-0 flex-1 gap-3 text-xs">
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-yes)]">
                Yes
              </span>
              <span className="tabular block font-semibold text-[var(--color-text)]">
                {formatImpliedPercent(market.yesPrice)}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-no)]">
                No
              </span>
              <span className="tabular block font-semibold text-[var(--color-text)]">
                {formatImpliedPercent(market.noPrice)}
              </span>
            </span>
          </div>
        )}
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={cn("pp-btn pp-btn-primary", tradable ? "flex-1" : "w-full")}
        >
          {tradable ? "Trade" : "View market state"}
        </button>
      </div>
    </div>
  );

  const sheet =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close trade panel"
              onClick={close}
              className="pp-fade absolute inset-0 bg-black/65"
            />
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Trade ${marketTitle(market)}`}
              className="pp-sheet absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span
                    aria-hidden
                    className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[var(--color-border-strong)]"
                  />
                  <p className="line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
                    {marketTitle(market)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="pp-btn pp-btn-ghost ml-2 shrink-0 px-2.5 py-2"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M4 4l10 10M14 4L4 14" />
                  </svg>
                </button>
              </div>
              <TradePanel market={market} variant="sheet" />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {bar}
      {sheet}
    </>
  );
}
