/**
 * ProbaSight brand marks.
 *
 * The glyph is an original drawing: a logistic (sigmoid) probability curve with
 * a focal node at its inflection point. The curve reads as forecasting, the
 * node as the "sight" the product is named for. Nothing here is derived from
 * any third-party brand asset, and in particular this is NOT a Panta mark.
 * Panta attribution is a separate element, `PoweredByPanta`.
 *
 * DROP-IN IMAGE ASSET
 * -------------------
 * Set BRAND_MARK_SRC to a file under `public/brand/` (see `public/brand/README.md`)
 * to render a supplied image instead of the inline SVG. The image is drawn with
 * `object-contain` inside a square box, so its aspect ratio is always preserved:
 * it is never stretched or squashed. Leaving it null keeps the inline SVG, which
 * is resolution-independent and follows the theme tokens.
 */
const BRAND_MARK_SRC: string | null = null;

export function ProbaSightMark({ className = "h-7 w-7" }: { className?: string }) {
  if (BRAND_MARK_SRC) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark, no layout shift to optimise
      <img
        src={BRAND_MARK_SRC}
        alt=""
        aria-hidden="true"
        className={`${className} object-contain`}
      />
    );
  }

  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" role="img" aria-label="ProbaSight">
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
      {/* Logistic curve: flat at both ends, steep through the middle. */}
      <path
        d="M4.5 20.5C11.5 20.5 14.5 7.5 23.5 7.5"
        stroke="var(--color-accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Focal node at the curve's inflection, punched out from the curve. */}
      <circle
        cx="13.25"
        cy="14"
        r="4.3"
        fill="var(--color-surface-2)"
      />
      <circle cx="13.25" cy="14" r="3" fill="var(--color-accent)" />
    </svg>
  );
}

export function ProbaSightWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-tight text-[var(--color-text)]">Proba</span>
      <span className="font-semibold tracking-tight text-[var(--color-accent)]">Sight</span>
    </span>
  );
}
