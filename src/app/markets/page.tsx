import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketsExplorer } from "@/components/markets/MarketsExplorer";
import { MarketGridSkeleton } from "@/components/common/States";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { enrichMarketsWithPrices } from "@/lib/panta/enrich";
import { listCategories, listMarkets } from "@/lib/panta/markets";
import { toAppError } from "@/lib/panta/errors";
import type { ApiErrorShape } from "@/lib/client-api";
import type { PantaMarket } from "@/lib/panta/types";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Browse live Panta prediction markets by category and phase, with readable YES/NO pricing.",
};

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  let markets: PantaMarket[] = [];
  let cursor: string | null = null;
  let categories: string[] = [];
  let error: ApiErrorShape | null = null;

  try {
    const [list, cats] = await Promise.all([
      listMarkets({ limit: 50 }),
      // Categories are secondary: their absence must not break the page.
      listCategories().catch(() => [] as string[]),
    ]);
    markets = await enrichMarketsWithPrices(list.items, 12);
    cursor = list.nextCursor ?? null;
    categories = cats;
  } catch (err) {
    const appError = toAppError(err);
    error = {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      retryable: appError.retryable,
    };
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Markets</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">
            Every market below is a live Panta market. Prices are USDC per share and settle
            at 1 USDC for the correct side.
          </p>
        </div>
        <PoweredByPanta />
      </div>

      <Suspense fallback={<MarketGridSkeleton count={9} />}>
        <MarketsExplorer
          initialMarkets={markets}
          initialCursor={cursor}
          categories={categories}
          initialError={error}
        />
      </Suspense>
    </div>
  );
}
