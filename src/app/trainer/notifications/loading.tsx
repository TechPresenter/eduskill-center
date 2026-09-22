import { Skeleton, SkeletonList } from "@/components/ui/feedback";

/** Matches the inbox: category chips, the filter row, then icon + two-line rows. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-3 motion-reduce:animate-none" aria-busy="true" aria-label="Loading notifications">
      <div className="flex gap-2 overflow-x-clip">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-11 w-44 rounded-md" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </div>
      <SkeletonList rows={6} />
    </div>
  );
}
