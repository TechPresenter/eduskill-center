import { getBranding, getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { markdownExcerpt } from "@/components/site/markdown";
import { listFeedPosts } from "@/server/blog-public";

/**
 * RSS 2.0 feed for the blog, served at `/blog/rss.xml`.
 *
 * It lives inside the `(site)` route group so the URL keeps the `/blog` prefix without the group
 * showing up in it, and because Next matches static segments before dynamic ones, `rss.xml` wins
 * over `/blog/[slug]`. `RESERVED_BLOG_SLUGS` in the admin slug helper keeps a post from ever being
 * slugged "rss.xml" and shadowing this route from the other direction.
 *
 * The XML is assembled by hand. The repo has no feed library and adding one for ~40 lines of string
 * building would be the only dependency in the blog module — see `esc()` for the part that actually
 * matters.
 */

/**
 * Rendered per request.
 *
 * `listFeedPosts` is built on `livePostWhere()`, whose `now()` is evaluated when the query runs.
 * Prerendering this route would freeze that cut-off at build time and a post scheduled for next
 * week would be pushed to every subscriber's reader immediately. The `s-maxage` header below is the
 * right place to trade freshness for load: a shared cache may hold the rendered feed for ten
 * minutes, but the rendering itself always sees the real clock.
 */
export const dynamic = "force-dynamic";

/**
 * XML text-node escaping. This is hand-built XML carrying author-written titles, excerpts and
 * bylines, so it is the one thing in this file that cannot be got wrong: a single unescaped `&` in
 * one post's title makes the whole document not well-formed and every reader drops the entire feed,
 * not just that item.
 *
 * `&` is replaced first, otherwise the ampersands introduced by the later replacements would be
 * escaped a second time. The final pass strips characters that XML 1.0 forbids outright (control
 * codes other than tab/newline/carriage-return) — no escape exists for them, and they reach us the
 * moment someone pastes from a PDF or a Word document.
 */
function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Written as unicode escapes rather than raw bytes so this file stays plain ASCII. Tab,
    // newline and carriage return are the only control characters XML 1.0 allows, so they are
    // the only ones left out of the range.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** RFC-822 date, which is what RSS 2.0 requires; `toUTCString()` already emits that shape. */
const rfc822 = (value: Date | null) => (value ?? new Date()).toUTCString();

export async function GET() {
  // A failure here is a genuine outage and is allowed to surface as a 500. Degrading to a valid but
  // empty <channel> would tell every subscribed reader that the blog is fine and simply has nothing
  // in it, which is a worse lie than a transient error they will retry.
  const [branding, defaultDescription, posts] = await Promise.all([
    getBranding(),
    getSetting<string>("seo.defaultDescription"),
    listFeedPosts(20),
  ]);

  const siteName = branding.siteName || "EduSkill India Foundation";
  const channelTitle = `${siteName} — Blog`;
  // There is no blog-specific description setting, and adding one would mean editing the settings
  // catalogue, so the admin-editable site description is the closest DB-driven text available. The
  // literal is only reached on a database that has never been seeded.
  const channelDescription = defaultDescription || `News, stories and insights from ${siteName}.`;
  const blogUrl = absoluteUrl("/blog");
  const feedUrl = absoluteUrl("/blog/rss.xml");

  // The newest post's own timestamp, not `now()`: a reader that polls hourly should see
  // lastBuildDate stay put until something actually changed.
  const lastBuildDate = rfc822(posts[0]?.updatedAt ?? null);

  const items = posts.map((post) => {
    const link = absoluteUrl(`/blog/${post.slug}`);
    // The joined author wins over the legacy/guest byline column, exactly as the article page does.
    const creator = post.author?.name || post.authorName || "";
    const summary = post.excerpt || markdownExcerpt(post.content, 300);
    return [
      "    <item>",
      `      <title>${esc(post.title)}</title>`,
      `      <link>${esc(link)}</link>`,
      // isPermaLink="true" is accurate here: the article URL is stable and the slug guard stops it
      // being reused by another post.
      `      <guid isPermaLink="true">${esc(link)}</guid>`,
      `      <pubDate>${rfc822(post.publishedAt)}</pubDate>`,
      creator ? `      <dc:creator>${esc(creator)}</dc:creator>` : null,
      summary ? `      <description>${esc(summary)}</description>` : null,
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${esc(channelTitle)}</title>`,
    `    <link>${esc(blogUrl)}</link>`,
    `    <description>${esc(channelDescription)}</description>`,
    "    <language>en-IN</language>",
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    // The self-link lets a reader that was handed the feed by some other route confirm its canonical
    // address, which is what stops the same feed being subscribed twice under two URLs.
    `    <atom:link rel="self" href="${esc(feedUrl)}" type="application/rss+xml" />`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // No browser caching (a reader polling for new posts must not be served its own copy), but a
      // shared cache may hold it for ten minutes — long enough to absorb a crawl, short enough that
      // a post published on the hour reaches subscribers within it.
      "Cache-Control": "public, max-age=0, s-maxage=600",
    },
  });
}
