import { Skeleton, SkeletonCardList } from "@/components/ui/feedback";

/** Matches the payments screen: the amount-due summary, then the payment history cards. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none lg:space-y-6" aria-busy="true" aria-label="Loading payments">
      <Skeleton className="h-7 w-48 lg:h-9" />
      <Skeleton className="h-32 rounded-card" />
      <Skeleton className="h-4 w-36" />
      <SkeletonCardList count={3} lines={4} />
    </div>
  );
}
