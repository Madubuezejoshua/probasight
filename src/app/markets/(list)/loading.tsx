import { MarketGridSkeleton, Skeleton } from "@/components/common/States";

/**
 * Loading boundary for the markets list only.
 *
 * Deliberately inside the (list) route group: placed at `markets/loading.tsx`
 * it would also wrap `markets/[marketId]`, whose `notFound()` must be able to
 * set a 404 status rather than streaming a 200 first.
 */
export default function MarketsLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <div className="mt-5">
        <MarketGridSkeleton count={9} />
      </div>
    </div>
  );
}
