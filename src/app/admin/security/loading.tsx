import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="Security Center" tabs stats filters={false} rows={5} variant="rows" />;
}
