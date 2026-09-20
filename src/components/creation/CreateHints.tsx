import type { ApiErrorShape } from "@/lib/client-api";

/**
 * Actionable guidance for create-flow failures.
 *
 * Panta's create quote and build can fail with a generic
 * `INVALID_MARKET_PARAMS` whose upstream message is only "unexpected create
 * quote/build failure, check server logs". That is accurate but useless to
 * someone filling in a form, so we name the causes actually observed against
 * the live API instead of leaving the user stuck.
 *
 * Verified causes:
 *  - an `imageUrl` Panta cannot fetch (it soft-validates reachability)
 *  - a creator wallet with no USDC token account on mainnet
 */
export function CreateFailureHint({ error }: { error: ApiErrorShape }) {
  const upstream = String(error.details?.upstreamMessage ?? "").toLowerCase();
  const isGenericCreateFailure =
    error.code === "INVALID_MARKET_PARAMS" && upstream.includes("unexpected create");

  if (!isGenericCreateFailure) return null;

  return (
    <div className="mt-2 rounded-[var(--radius-control)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-dim)]/40 p-2.5">
      <p className="text-xs font-semibold text-[var(--color-warning)]">
        Panta rejected this without saying why. The usual causes:
      </p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-[var(--color-muted)]">
        <li>
          <strong className="text-[var(--color-text)]">The image URL.</strong> Panta fetches
          it to validate. A URL that 404s, needs auth, or sits behind a private host is
          rejected. Use the <strong>Upload image</strong> button, which goes through Panta&apos;s
          own uploader and always produces a URL it accepts.
        </li>
        <li>
          <strong className="text-[var(--color-text)]">Wallet has never held USDC.</strong>{" "}
          Creation builds a transaction against your USDC token account. If the connected
          wallet has no USDC on mainnet, that account does not exist yet. Fund it first.
        </li>
        <li>
          <strong className="text-[var(--color-text)]">Duplicate question.</strong> The same
          creator wallet cannot post the identical question twice.
        </li>
      </ul>
    </div>
  );
}
