import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { MarketPhase } from "@/lib/panta/types";

/**
 * Shared market presentation atoms.
 *
 * Phase badges pair colour with a text label so state is never communicated by
 * colour alone.
 */

const PHASE_STYLES: Record<MarketPhase, { label: string; className: string }> = {
  primary: {
    label: "Primary",
    className:
      "border-[var(--color-accent)]/35 bg-[var(--color-accent-dim)]/50 text-[var(--color-accent)]",
  },
  secondary: {
    label: "Secondary",
    className:
      "border-[var(--color-warning)]/35 bg-[var(--color-warning-dim)]/60 text-[var(--color-warning)]",
  },
  resolved: {
    label: "Resolved",
    className:
      "border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-muted)]",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-[var(--color-no)]/35 bg-[var(--color-no-dim)]/50 text-[var(--color-no)]",
  },
};

export function PhaseBadge({
  phase,
  className,
}: {
  phase: string | null | undefined;
  className?: string;
}) {
  const style = PHASE_STYLES[(phase ?? "") as MarketPhase];
  if (!style) {
    return (
      <span className={cn("pp-chip", className)}>{phase ? String(phase) : "Unknown"}</span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-chip)] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

export function CategoryChip({ category }: { category: string | null | undefined }) {
  if (!category) return null;
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-faint)]">
      {category}
    </span>
  );
}

/**
 * Market thumbnail. Panta catalog images are arbitrary public URLs, so a broken
 * or missing image falls back to a neutral monogram rather than a broken tile.
 */
export function MarketImage({
  images,
  title,
  size = 44,
  className,
}: {
  images: string[] | null | undefined;
  title: string;
  size?: number;
  className?: string;
}) {
  const src = images?.find((url) => typeof url === "string" && /^https?:\/\//i.test(url));

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-sm font-bold text-[var(--color-faint)]",
          className,
        )}
        aria-hidden
      >
        {title.trim().charAt(0).toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
        unoptimized={false}
      />
    </div>
  );
}
