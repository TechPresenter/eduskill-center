import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="success stories" tabs cols={5} />;
}
