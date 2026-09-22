import { Skeleton, SkeletonTable } from "@/components/ui/feedback";

/**
 * Route skeleton for districts. It mirrors the real page's blocks in the same order and at the same
 * heights, so the switch to live content does not shift anything — title, filters, then the table (row cards below md).
 */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading districts">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-md lg:h-[4.5rem] lg:rounded-card" />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
