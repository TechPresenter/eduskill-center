import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="website sections" filters={false} variant="rows" rows={8} />;
}
