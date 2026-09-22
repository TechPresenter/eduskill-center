import { Skeleton, SkeletonTable } from "@/components/ui/feedback";

/**
 * The route-level loading state for every admin page. It deliberately traces the shape most of them
 * share — page title, toolbar, then a list — so the layout does not jump when the real content lands.
 * Phones get the card skeleton the tables themselves collapse into below `md`.
 */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-5 motion-reduce:animate-none" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* Page header: title, one-line description, primary action. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 max-lg:hidden" />
      </div>

      {/* Filter toolbar. */}
      <Skeleton className="h-12 w-full lg:h-[4.5rem]" />

      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
