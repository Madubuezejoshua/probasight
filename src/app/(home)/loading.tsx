import { MarketGridSkeleton, Skeleton } from "@/components/common/States";

/**
 * Loading boundary scoped to the homepage only.
 *
 * It lives in a route group rather than at the app root on purpose: a root
 * `loading.tsx` creates a Suspense boundary above every route, which makes Next
 * stream a 200 before `notFound()` can run, so a missing market would render
 * the 404 page with a 200 status. Scoping each boundary keeps streaming where
 * it helps without breaking 404s on /markets/[marketId].
 */
export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      <section className="border-b border-[var(--color-border-subtle)] py-10 sm:py-14">
        <Skeleton className="h-6 w-64 rounded-full" />
        <Skeleton className="mt-4 h-12 w-80 max-w-full" />
        <Skeleton className="mt-3 h-12 w-64 max-w-full" />
        <Skeleton className="mt-5 h-5 w-96 max-w-full" />
        <div className="mt-7 flex gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      </section>
      <section className="py-8 sm:py-10">
        <Skeleton className="h-6 w-44" />
        <div className="mt-4">
          <MarketGridSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
