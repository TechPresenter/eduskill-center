import { EditorSkeleton } from "@/components/admin/content/skeletons";

export default function Loading() {
  // `aside` on purpose: `BlogEditor` renders its outline / listing-preview column at xl+ on the
  // create screen too, so a skeleton without it would collapse to one column and then jump.
  return <EditorSkeleton label="new blog post" />;
}
