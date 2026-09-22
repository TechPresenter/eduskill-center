import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  return <ListSkeleton label="support tickets" tabs cols={8} />;
}
