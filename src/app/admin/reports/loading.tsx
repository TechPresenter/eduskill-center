import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="reports" filters={false} variant="rows" rows={8} />;
}
