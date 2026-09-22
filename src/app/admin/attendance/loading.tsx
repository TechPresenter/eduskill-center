import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/**
 * Route skeleton for the attendance workspace: title, the three-tab strip, the centre/batch/date
 * selector row, then the roster the mark sheet fills in.
 */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading attendance">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2 overflow-x-clip border-b border-line pb-2">
        {["sheet", "reports", "student"].map((t) => (
          <Skeleton key={t} className="h-8 w-32 shrink-0 rounded-md" />
        ))}
      </div>
      <div className="card card-p grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 rounded-md" />
        ))}
      </div>
      <SkeletonCardList count={6} lines={2} />
    </div>
  );
}
