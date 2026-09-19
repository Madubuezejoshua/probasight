/**
 * Panta Pulse wordmark: an original pulse glyph drawn as a single ECG-style
 * trace. Nothing here is derived from any third-party brand asset.
 */
export function PulseGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 28"
      fill="none"
      role="img"
      aria-label="Panta Pulse"
    >
      <rect
        x="0.75"
        y="0.75"
        width="26.5"
        height="26.5"
        rx="7.25"
        fill="var(--color-surface-2)"
        stroke="var(--color-border-strong)"
        strokeWidth="1.5"
      />
      <path
        d="M4.5 15.2h4.1l2.4-6.4 3.3 11.2 2.5-7.1 1.7 2.3h4"
        stroke="var(--color-accent)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-tight text-[var(--color-text)]">Panta</span>
      <span className="font-semibold tracking-tight text-[var(--color-accent)]"> Pulse</span>
    </span>
  );
}
