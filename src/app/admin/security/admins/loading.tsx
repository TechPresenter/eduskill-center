import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="administrators" tabs filters={false} cols={7} />;
}
