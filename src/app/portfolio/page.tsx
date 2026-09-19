import type { Metadata } from "next";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Your Panta positions, wallet activity, claimable winnings and created markets.",
};

export default function PortfolioPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Portfolio</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">
            Positions, activity and claims read live from Panta for your connected wallet.
          </p>
        </div>
        <PoweredByPanta />
      </div>

      <PortfolioDashboard />
    </div>
  );
}
