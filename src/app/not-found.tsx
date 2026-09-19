import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="tabular text-5xl font-bold text-[var(--color-border-strong)]">
        404
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
        This page does not exist, or the market address is not in Panta&apos;s catalog.
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
