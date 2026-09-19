"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { truncateAddress } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Wallet control. Renders a connect action when disconnected, and a pill with
 * the truncated address plus copy/disconnect when connected.
 */
export function ConnectWalletButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { publicKey, disconnect, connecting, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked by permissions; the address stays visible.
    }
  }, [address]);

  if (!connected || !address) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={cn("pp-btn pp-btn-primary", compact && "px-3 py-2 text-xs", className)}
      >
        {connecting ? "Connecting…" : compact ? "Connect" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "pp-btn pp-btn-secondary font-mono",
          compact ? "px-2.5 py-2 text-xs" : "text-xs",
        )}
      >
        <span
          aria-hidden
          className="pp-live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-yes)]"
        />
        {truncateAddress(address)}
      </button>

      {open && (
        <div
          role="menu"
          className="pp-fade absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-elevated)] shadow-2xl"
        >
          <div className="border-b border-[var(--color-border-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
              {wallet?.adapter.name ?? "Wallet"}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-[var(--color-muted)]">
              {address}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={copyAddress}
            className="block w-full px-3 py-2.5 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            {copied ? "Address copied" : "Copy address"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
            className="block w-full border-t border-[var(--color-border-subtle)] px-3 py-2.5 text-left text-sm text-[var(--color-no)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
