import { Skeleton, SkeletonList } from "@/components/ui/feedback";

/** Matches My Assignments: centers and courses as rows with an icon tile and a status. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading your assignments">
      <Skeleton className="hidden h-9 w-56 lg:block" />
      <Skeleton className="h-4 w-64" />
      <SkeletonList rows={4} />
    </div>
  );
}
