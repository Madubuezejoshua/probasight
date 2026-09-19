"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {

    console.error("app error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-no)]/40 bg-[var(--color-no-dim)]/50 text-lg font-bold text-[var(--color-no)]"
      >
        !
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
        This page failed to render. The error has been logged on the server. Nothing was
        signed or broadcast.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-[var(--color-faint)]">
          digest {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="pp-btn pp-btn-primary">
          Try again
        </button>
        <Link href="/markets" className="pp-btn pp-btn-secondary">
          Back to markets
        </Link>
      </div>
    </div>
  );
}
