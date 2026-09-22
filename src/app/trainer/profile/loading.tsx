import { Skeleton, SkeletonList } from "@/components/ui/feedback";

/** Matches My Profile on a phone: centred identity block, edit button, about card and the shortcut list. */
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label="Loading your profile">
      <div className="flex flex-col items-center gap-2 py-2">
        <Skeleton className="h-[88px] w-[88px] rounded-full" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <Skeleton className="h-12 rounded-md" />
      <div className="card card-p space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <SkeletonList rows={4} avatar={false} />
    </div>
  );
}
