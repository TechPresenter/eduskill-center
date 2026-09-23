import { ListSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  // Eight columns: Post, Author, Category, Tags, Status, Read, Published, Updated.
  return <ListSkeleton label="blog posts" cols={8} />;
}
