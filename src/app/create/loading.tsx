import { Skeleton } from "@/components/common/States";

export default function CreateLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
