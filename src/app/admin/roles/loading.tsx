import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="roles" filters={false} cols={6} rows={6} />;
}
