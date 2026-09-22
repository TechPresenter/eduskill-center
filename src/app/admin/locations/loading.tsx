import { Skeleton, SkeletonTable } from "@/components/ui/feedback";

/**
 * Route skeleton for the locations overview: title, the three level cards (tile, figure, blurb,
 * breakdown, link) and the coverage table, in the same order and at the same heights as the page.
 */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-6 motion-reduce:animate-none" aria-busy="true" aria-label="Loading locations">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card card-p space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-3 gap-2 border-t border-line pt-3">
              {Array.from({ length: 3 }).map((__, j) => (
                <Skeleton key={j} className="h-9" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}
