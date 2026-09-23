import { absoluteUrl, truncate } from "@/lib/utils";
import { stripMarkdown } from "./markdown";

/**
 * schema.org builders for the blog. Pure functions returning plain objects — hand the result
 * to `<JsonLd data={…} />` (src/components/site/json-ld.tsx), which does the escaping.
 *
 * Every URL goes through `absoluteUrl()`, which composes `withBasePath()` and is already
 * correct for a sub-path deployment (`https://eduskillindia.org/center/blog/…`). NEVER hand-
 * prefix a path here: `absoluteUrl` is idempotent for values that are already URLs, so a cover
 * image stored as `https://cdn/x.jpg` passes through untouched while `/uploads/x.jpg` is
 * expanded correctly.
 *
 * Keys whose value is `undefined` disappear during `JSON.stringify`, which is how the optional
 * members below are "omitted" — an explicit `null` would be published as a null, and Google
 * treats a null where it expects a URL as a broken field.
 */

/** Only the post fields structured data reads, so any `select` shape satisfies it. */
export type JsonLdPost = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  seoDescription?: string | null;
  coverImage?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  authorName?: string | null;
  tags?: string[];
  wordCount?: number;
  readingMinutes?: number;
};

export type JsonLdAuthor = { name: string; slug: string; avatar?: string | null; role?: string | null };
export type JsonLdCategory = { name: string; slug?: string | null };

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** The description search engines quote: the authored SEO copy, else the lede, else the body. */
function postDescription(post: JsonLdPost): string | undefined {
  const text = post.seoDescription || post.excerpt || truncate(stripMarkdown(post.content), 160);
  return text || undefined;
}

/** The article's own address: an explicit canonical (a syndicated piece) wins over the slug. */
function postUrl(post: JsonLdPost): string {
  return post.canonicalUrl || absoluteUrl(`/blog/${post.slug}`);
}

/**
 * `BlogPosting` for one article.
 *
 * The byline degrades in three steps, mirroring what the page renders: a real `BlogAuthor`
 * (a Person with an archive page and an avatar) → the legacy `authorName` guest byline (a
 * Person with a name and nothing else) → the Foundation itself (an Organization). Emitting a
 * Person with no name at all would be worse than emitting none.
 */
export function blogPostingJsonLd(args: {
  post: JsonLdPost;
  author?: JsonLdAuthor | null;
  category?: JsonLdCategory | null;
  siteName: string;
  logoUrl?: string | null;
}): Record<string, unknown> {
  const { post, author, category, siteName, logoUrl } = args;
  const published = iso(post.publishedAt) ?? iso(post.createdAt);
  // A 1200×630 OG crop is the better share image; the 16:9 cover is the fallback, never both.
  const image = post.ogImage || post.coverImage || null;
  const url = postUrl(post);
  const keywords = (post.tags ?? []).filter(Boolean).join(", ");

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    // schema.org caps headline at 110 characters; a longer one is simply ignored by Google.
    headline: truncate(post.title, 110),
    description: postDescription(post),
    image: image ? [absoluteUrl(image)] : undefined,
    datePublished: published,
    dateModified: iso(post.updatedAt) ?? published,
    author: author
      ? {
          "@type": "Person",
          name: author.name,
          url: absoluteUrl(`/blog/author/${author.slug}`),
          image: author.avatar ? absoluteUrl(author.avatar) : undefined,
          jobTitle: author.role || undefined,
        }
      : post.authorName
        ? { "@type": "Person", name: post.authorName }
        : { "@type": "Organization", name: siteName },
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: logoUrl ? { "@type": "ImageObject", url: absoluteUrl(logoUrl) } : undefined,
    },
    url,
    mainEntityOfPage: url,
    articleSection: category?.name || undefined,
    keywords: keywords || undefined,
    wordCount: post.wordCount || undefined,
    timeRequired: post.readingMinutes ? `PT${post.readingMinutes}M` : undefined,
    inLanguage: "en-IN",
    isAccessibleForFree: true,
  };
}

/**
 * `BreadcrumbList` for the trail above an article or an archive.
 *
 * `position` is 1-based, and the LAST crumb carries no `item` — it is the page you are already
 * on, and pointing it at itself is what makes Google drop the whole breadcrumb.
 */
export function breadcrumbJsonLd(items: { name: string; path?: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: index === items.length - 1 || !item.path ? undefined : absoluteUrl(item.path),
    })),
  };
}

/**
 * `Blog` for the index and the archive pages: the collection itself, plus an `ItemList` of the
 * posts currently on the page so a crawler sees the ordering it was served rather than
 * guessing it from the markup.
 */
export function blogIndexJsonLd(args: { siteName: string; description?: string | null; posts: { title: string; slug: string }[] }): Record<string, unknown> {
  const { siteName, description, posts } = args;
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${siteName} Blog`,
    description: description || undefined,
    url: absoluteUrl("/blog"),
    publisher: { "@type": "Organization", name: siteName },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "BlogPosting",
          headline: truncate(post.title, 110),
          url: absoluteUrl(`/blog/${post.slug}`),
        },
      })),
    },
  };
}
