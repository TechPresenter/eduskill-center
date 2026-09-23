/**
 * The public blog's component kit — one import path for the index, the article, the three
 * archives and the draft preview.
 *
 * MIXED SERVER/CLIENT SURFACE. Most of these are server components; `ReadingProgress`,
 * `ShareRow` and `TocActive` carry their own `"use client"` directive, so a server page can
 * import any of them from here without thinking about the boundary. A component that is itself
 * `"use client"` should import the specific file it needs rather than this barrel, so it does not
 * drag the server-only pieces (and `Markdown`, and the Prisma-adjacent types) into its bundle.
 *
 * There is deliberately no view beacon and no view counter: the blog stores no `viewCount` and
 * exposes no unauthenticated public write endpoint.
 */

export { ArticleBody, type ArticleBodyPost, type ArticleBodyProps } from "./article-body";
export { AuthorByline, type AuthorBylineProps, type BylineAuthor } from "./author-byline";
export { AuthorCard, type AuthorCardAuthor, type AuthorCardProps } from "./author-card";
export { CategoryChips, type CategoryChipItem, type CategoryChipsProps } from "./category-chips";
export { PostCard, type PostCardPost, type PostCardProps, type PostCardVariant } from "./post-card";
export { PostMeta, type PostMetaProps, type PostMetaTone } from "./post-meta";
export { PrevNextPosts, type PrevNextPost } from "./prev-next";
export { ReadingProgress } from "./reading-progress";
export { ShareRow } from "./share-row";
export { TableOfContents, type TableOfContentsProps } from "./table-of-contents";
export { TagPill, tagPillClasses, type TagPillProps, type TagPillSize } from "./tag-pill";
export { TocActive } from "./toc-active";
