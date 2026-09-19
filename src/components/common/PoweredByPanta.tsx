import { cn } from "@/lib/utils/cn";

/**
 * Required Panta attribution.
 *
 * Panta's Terms of Use section 6 require the exact wording "Powered by Panta",
 * clearly legible and reasonably prominent, on every surface that displays
 * Panta-powered functionality. The string is intentionally hard-coded and must
 * not be abbreviated, hidden or made conditional.
 */
export function PoweredByPanta({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "subtle" | "inline";
}) {
  const content = (
    <>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
      />
      Powered by Panta
    </>
  );

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)]",
          className,
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href="https://panta.market"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] text-xs font-medium transition-colors",
        variant === "subtle"
          ? "text-[var(--color-muted)] hover:text-[var(--color-accent)]"
          : "border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[var(--color-muted)] hover:border-[var(--color-accent-dim)] hover:text-[var(--color-accent)]",
        className,
      )}
    >
      {content}
    </a>
  );
}
