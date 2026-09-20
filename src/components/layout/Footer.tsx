import Link from "next/link";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { ProbaSightMark, ProbaSightWordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2">
              <ProbaSightMark className="h-6 w-6" />
              <ProbaSightWordmark className="text-sm" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              An AI-powered prediction-market intelligence and trading terminal. Market
              data, pricing, positions and settlement are provided by Panta; transactions
              are signed by your own wallet and settled on Solana.
            </p>
            <PoweredByPanta className="mt-4" />
          </div>

          <div className="flex gap-10 text-sm sm:gap-14">
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Product
              </p>
              <ul className="space-y-2 text-[var(--color-muted)]">
                <li>
                  <Link href="/markets" className="transition-colors hover:text-[var(--color-text)]">
                    Markets
                  </Link>
                </li>
                <li>
                  <Link href="/portfolio" className="transition-colors hover:text-[var(--color-text)]">
                    Portfolio
                  </Link>
                </li>
                <li>
                  <Link href="/create" className="transition-colors hover:text-[var(--color-text)]">
                    Create market
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
                Infrastructure
              </p>
              <ul className="space-y-2 text-[var(--color-muted)]">
                <li>
                  <a
                    href="https://panta.market"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--color-text)]"
                  >
                    Panta
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.panta.market"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--color-text)]"
                  >
                    Panta API docs
                  </a>
                </li>
                <li>
                  <a
                    href="https://solana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--color-text)]"
                  >
                    Solana
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--color-border-subtle)] pt-5">
          <p className="text-xs leading-relaxed text-[var(--color-faint)]">
            ProbaSight is an independent interface built on the Panta public API. It is
            not operated or endorsed by Panta. Prediction markets carry risk of total
            loss. Nothing in this interface, including AI-generated analysis, is financial
            advice. Verify each market&apos;s resolution rules before trading.
          </p>
        </div>
      </div>
    </footer>
  );
}
