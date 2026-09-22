import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Matches the applications list: title block, then one card per application. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none lg:space-y-6" aria-busy="true" aria-label="Loading applications">
      <Skeleton className="h-7 w-44 lg:h-9" />
      <SkeletonCardList count={3} lines={3} />
    </div>
  );
}
