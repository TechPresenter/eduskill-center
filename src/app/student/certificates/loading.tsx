import { Skeleton } from "@/components/ui/feedback";

/** Matches a certificate card: navy header, A4-landscape preview, detail grid, action row. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none lg:space-y-6" aria-busy="true" aria-label="Loading certificates">
      <Skeleton className="h-7 w-44 lg:h-9" />
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="h-[74px] rounded-none" />
            <div className="space-y-4 p-4 sm:p-5">
              <Skeleton className="aspect-[1.414/1] w-full rounded-md" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, k) => (
                  <Skeleton key={k} className="h-9" />
                ))}
              </div>
              <Skeleton className="h-11 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
