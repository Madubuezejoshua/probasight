"use client";

import { cn } from "@/lib/utils/cn";
import type { ApiErrorShape } from "@/lib/client-api";

/** Shared loading, empty and error surfaces so every page behaves the same way. */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("pp-skeleton", className)} aria-hidden />;
}

export function MarketCardSkeleton() {
  return (
    <div className="pp-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function MarketGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <MarketCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="pp-card flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-[var(--color-faint)]">{icon}</div>}
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Error surface. Shows the upstream code so a judge or operator can see exactly
 * which Panta failure occurred, and offers retry only when the error is
 * genuinely retryable.
 */
export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: ApiErrorShape;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const fields = error.details?.fields as Record<string, string[]> | undefined;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-no)]/35 bg-[var(--color-no-dim)]/45",
        compact ? "p-3" : "p-5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-no)]/50 text-[11px] font-bold text-[var(--color-no)]"
        >
          !
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">{error.message}</p>
          {fields && (
            <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-muted)]">
              {Object.entries(fields).map(([field, messages]) => (
                <li key={field}>
                  <span className="font-mono text-[var(--color-text)]">{field}</span>:{" "}
                  {messages.join(", ")}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
            {error.code}
          </p>
          {onRetry && error.retryable !== false && (
            <button type="button" onClick={onRetry} className="pp-btn pp-btn-secondary mt-3">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small inline spinner for button and status use. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
