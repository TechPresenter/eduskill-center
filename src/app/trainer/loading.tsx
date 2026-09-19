import { Skeleton, SkeletonCard } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
    </div>
  );
}
