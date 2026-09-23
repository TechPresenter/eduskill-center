/**
 * Filter metadata for the admin blog list.
 *
 * This file used to hold `blogFields()`, the 11-entry `FieldDef[]` that drove the generic
 * `ContentEditor` on the create and edit screens. Both screens now render `BlogEditor`
 * (`src/components/admin/blog/blog-editor.tsx`), which is a real form with its own typed values
 * rather than a config array, so the definition had nothing left to drive and is gone.
 */

/**
 * The status filter. Two of these values do not exist in `ContentStatus`: `listBlogs` translates
 * `SCHEDULED` into "PUBLISHED with a future date" and `LIVE` into `livePostWhere()`, which is how
 * an editor actually thinks about the queue ("what is out?" / "what is waiting?"). `PUBLISHED`
 * keeps the raw meaning — both halves at once — so nothing becomes unreachable from the filter.
 */
export const BLOG_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "LIVE", label: "Live now" },
  { value: "PUBLISHED", label: "Published (any date)" },
  { value: "ARCHIVED", label: "Archived" },
];
