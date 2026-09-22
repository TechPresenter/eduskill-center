import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Matches the attendance screen: per-batch summary cards, then the month-grouped record list. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none lg:space-y-6" aria-busy="true" aria-label="Loading attendance">
      <Skeleton className="h-7 w-40 lg:h-9" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-4 w-40" />
      <SkeletonCardList count={4} lines={2} />
    </div>
  );
}
