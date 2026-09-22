import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Matches the courses list: enrolled cards, then the discover grid. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none lg:space-y-6" aria-busy="true" aria-label="Loading courses">
      <Skeleton className="h-7 w-40 lg:h-9" />
      <SkeletonCardList count={2} lines={3} />
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
    </div>
  );
}
