import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="permission catalog" tabs variant="rows" rows={10} />;
}
