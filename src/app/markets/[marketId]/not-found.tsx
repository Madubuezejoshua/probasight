import Link from "next/link";

/**
 * Segment-level not-found boundary for a single market.
 *
 * Having this next to the page (rather than falling through to the root
 * boundary) lets Next resolve the 404 within the dynamic segment, and lets the
 * copy name the actual cause: a malformed address or a market Panta does not
 * have, rather than a generic missing page.
 */
export default function MarketNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="tabular text-5xl font-bold text-[var(--color-border-strong)]">404</span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Market not found</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
        That market address is not in Panta&apos;s catalog. It may have been mistyped, or the
        market may not exist on this network.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/markets" className="pp-btn pp-btn-primary">
          Browse markets
        </Link>
        <Link href="/" className="pp-btn pp-btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
