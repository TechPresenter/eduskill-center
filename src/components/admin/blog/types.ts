/**
 * The shapes the blog editor passes around.
 *
 * The blog form is deliberately NOT built on `FormValues` (`Record<string, unknown>`) from
 * `@/components/admin/content/fields`: that type is what lets the generic `ContentEditor` drive
 * three different screens, and it is also why every read of a value there needs `str(...)`. The
 * blog editor is a single, known form, so it gets a real interface — a typo in a field name is a
 * compile error, and the payload lines up 1:1 with `blogSchema` in `@/server/blog`.
 *
 * Keep the keys identical to that Zod schema. The API coerces `""` → `null` for every optional
 * id / url field, so the form can keep everything as a plain string and never juggle nulls.
 */

/** The three real `ContentStatus` values a post can carry. "Scheduled" is derived, never stored. */
export type BlogEditorStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface BlogFormValues {
  title: string;
  /** Empty means "derive it from the title on save" — the service owns uniqueness. */
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverImageAlt: string;
  /** A `BlogAuthor` id. Empty falls back to the free-text `authorName` byline. */
  authorId: string;
  authorName: string;
  categoryId: string;
  tags: string[];
  status: BlogEditorStatus;
  /** `datetime-local` string (`2026-09-26T09:00`), i.e. the browser's local time. Empty = none. */
  publishedAt: string;
  isFeatured: boolean;
  /** Up to 3 manually pinned related posts, in the order they should appear. */
  relatedPostIds: string[];
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  noIndex: boolean;
}

/** One entry in the category / author `<Select>`s, loaded server-side and passed into the editor. */
export interface BlogOption {
  value: string;
  label: string;
}

/** A post that can be pinned as a related article (search result or already-pinned row). */
export interface RelatedOption {
  id: string;
  title: string;
  slug: string;
}
