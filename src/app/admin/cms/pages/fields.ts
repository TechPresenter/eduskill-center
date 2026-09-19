import type { FieldDef } from "@/components/admin/content/fields";

/** Form definition shared by the create and edit pages. */
export function cmsPageFields(opts: { fixed: boolean; canPublish: boolean }): FieldDef[] {
  return [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "slug", label: "URL slug", type: "slug", from: "title", disabled: opts.fixed, hint: opts.fixed ? "This page is linked from the website; its address cannot change." : "Lowercase letters, numbers and hyphens." },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "DRAFT", label: "Draft (hidden)" },
        { value: "PUBLISHED", label: "Published" },
      ],
      disabled: !opts.canPublish,
      hint: opts.canPublish ? "Draft pages return “not found” on the website." : "Changing the status requires the Publish Website Content permission.",
    },
    { key: "excerpt", label: "Excerpt", type: "textarea", rows: 2, hint: "Short summary used in listings and search results." },
    { key: "content", label: "Content", type: "textarea", markdown: true, rows: 18, required: true },
    { key: "seoTitle", label: "SEO title", type: "text", hint: "Defaults to the page title." },
    { key: "seoDescription", label: "SEO description", type: "textarea", rows: 2 },
  ];
}
