import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listBlogAuthors, listBlogCategories } from "@/server/blog";
import { PageHeader } from "@/components/ui/misc";
import { BlogEditor } from "@/components/admin/blog/blog-editor";
import type { BlogFormValues } from "@/components/admin/blog/types";

export const metadata = { title: "New Blog Post" };

export default async function NewBlogPage() {
  // Creating and updating a post both sit on `cms.update`; the permission catalog has no
  // `cms.create`. Publishing (or scheduling) additionally needs `cms.publish`, which the service
  // enforces on save — the editor only uses the flag to explain the greyed-out control.
  const user = await requireAdmin("cms.update");
  // Only the active rows: an author who has left or a retired category should not be reachable
  // from a blank post, even though the edit screen still shows one that is already attached.
  const [categories, authors] = await Promise.all([listBlogCategories({ activeOnly: true }), listBlogAuthors({ activeOnly: true })]);

  /**
   * Every key is present and every value is a plain string / array — `BlogFormValues` has no
   * nulls, so the form never has to decide whether an empty field means "unset" or "not loaded".
   * The API turns `""` back into `null` for each optional id and URL.
   */
  const initial: BlogFormValues = {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    coverImageAlt: "",
    authorId: "",
    // A sensible first byline: whoever is writing. Replaced the moment a real `BlogAuthor` is picked.
    authorName: user.name,
    categoryId: "",
    tags: [],
    status: "DRAFT",
    publishedAt: "",
    isFeatured: false,
    relatedPostIds: [],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    ogImage: "",
    noIndex: false,
  };

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "New post" }]} title="New blog post" mobileTitle="New post" backHref="/admin/blog" description="Write in Markdown. Save as a draft first, then publish or schedule it when it is ready." />
      <BlogEditor
        initial={initial}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        authors={authors.map((a) => ({ value: a.id, label: a.name }))}
        relatedInitial={[]}
        canEdit
        canPublish={hasPermission(user, "cms.publish")}
        // Nothing to delete until the post exists; the editor hides the button entirely.
        canDelete={false}
      />
    </div>
  );
}
