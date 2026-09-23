/**
 * Barrel for the blog's shared primitives: text measurement, heading anchors, the visibility
 * gate and the schema.org builders.
 *
 * SERVER SURFACE. `./markdown` re-exports from `@/components/site/markdown`, so importing this
 * barrel pulls the renderer (React, next/link) in with it. A client component ("use client")
 * that only needs `displayStatus` / `scheduledIn` / `isScheduled` should import
 * `@/lib/blog/visibility` DIRECTLY — that module is `import type`-only against Prisma and
 * carries nothing else.
 */

export { extractHeadings, headingId, markdownWordCount, readingMinutes, stripMarkdown, type TocHeading } from "./markdown";
export { LIVE_STATUS, displayStatus, isLive, isScheduled, livePostWhere, scheduledIn, type BlogDisplayStatus, type PostVisibility } from "./visibility";
export { blogIndexJsonLd, blogPostingJsonLd, breadcrumbJsonLd, type JsonLdAuthor, type JsonLdCategory, type JsonLdPost } from "./jsonld";
