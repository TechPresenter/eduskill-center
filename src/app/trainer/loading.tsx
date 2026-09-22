import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Route-level placeholder shaped like the phone home: greeting, trainer card, today's classes, tile grid. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <Skeleton className="h-36 rounded-card" />
      <div className="card divide-y divide-line">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-card" />
        ))}
      </div>
      <SkeletonCardList count={2} lines={2} />
    </div>
  );
}
