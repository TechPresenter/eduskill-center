import type { FieldDef } from "@/components/admin/content/fields";

export const BLOG_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft (hidden)" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived (hidden)" },
];

/** Form definition shared by the create and edit pages. */
export function blogFields(opts: { canPublish: boolean }): FieldDef[] {
  return [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "slug", label: "URL slug", type: "slug", from: "title", hint: "Public address: /blog/<slug>" },
    { key: "status", label: "Status", type: "select", options: BLOG_STATUS_OPTIONS, disabled: !opts.canPublish, hint: opts.canPublish ? undefined : "Changing the status requires the Publish Website Content permission." },
    { key: "publishedAt", label: "Publish date", type: "datetime", hint: "Leave empty to use the moment the post is published." },
    { key: "authorName", label: "Author", type: "text", placeholder: "e.g. EduSkill Team" },
    { key: "tags", label: "Tags", type: "tags", placeholder: "Type a tag and press Enter" },
    { key: "excerpt", label: "Excerpt", type: "textarea", rows: 2, hint: "Shown on the blog listing and in social previews." },
    { key: "coverImage", label: "Cover image", type: "image", folder: "blog" },
    { key: "content", label: "Content", type: "textarea", markdown: true, rows: 20, required: true },
    { key: "seoTitle", label: "SEO title", type: "text" },
    { key: "seoDescription", label: "SEO description", type: "textarea", rows: 2 },
  ];
}
