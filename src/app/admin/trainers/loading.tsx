import { Skeleton, SkeletonTable } from "@/components/ui/feedback";

/**
 * Route skeleton for trainers. It mirrors the real page's blocks in the same order and at the same
 * heights, so the switch to live content does not shift anything — title, stat cards, filters, then the table (row cards below md).
 */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading trainers">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-md lg:h-[4.5rem] lg:rounded-card" />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
