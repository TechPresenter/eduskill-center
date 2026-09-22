import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Matches the documents checklist: progress summary, then one card per document type. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none lg:space-y-6" aria-busy="true" aria-label="Loading documents">
      <Skeleton className="h-7 w-40 lg:h-9" />
      <Skeleton className="h-20 rounded-card" />
      <SkeletonCardList count={4} lines={2} />
    </div>
  );
}
