import { MarketGridSkeleton, Skeleton } from "@/components/common/States";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-8">
        <MarketGridSkeleton count={6} />
      </div>
    </div>
  );
}
