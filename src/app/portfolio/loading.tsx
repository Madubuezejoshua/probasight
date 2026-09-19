import { RowSkeleton, Skeleton } from "@/components/common/States";

export default function PortfolioLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="mt-6">
        <RowSkeleton rows={4} />
      </div>
    </div>
  );
}
