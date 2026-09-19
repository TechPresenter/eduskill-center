import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Route-level placeholder: matches the phone home (greeting, hero card, tile grid, card list). */
export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-2xl" />
        ))}
      </div>
      <SkeletonCardList count={2} lines={3} />
    </div>
  );
}
