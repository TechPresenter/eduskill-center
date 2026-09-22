import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="templates" stats tabs filters variant="rows" rows={8} />;
}
