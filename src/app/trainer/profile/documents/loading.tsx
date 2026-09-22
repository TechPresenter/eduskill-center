import { Skeleton } from "@/components/ui/feedback";

/** Matches "My documents": summary card and resume hero on the left, the document list on the right. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading your documents">
      <Skeleton className="hidden h-9 w-56 lg:block" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <div className="card card-p space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="card card-p space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-11 rounded-md" />
          </div>
        </div>
        <div className="card divide-y divide-line lg:col-span-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
