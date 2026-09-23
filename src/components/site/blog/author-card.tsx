import { Globe, Mail } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The fuller author block: avatar, name, role, bio, socials and a way through to everything else
 * they have written. Rendered at the end of an article and, in `dark` tone, inside the navy hero
 * of `/blog/author/[slug]`.
 *
 * WHY INLINE SVG for LinkedIn and X: lucide ships no brand marks, and the paths below are COPIED
 * from `src/components/site/social-links.tsx` rather than imported — that file exports a
 * branding-driven component, not its glyph table, and it is owned by another part of the site.
 * Two literals of the same 24×24 path is the cheaper coupling. `websiteUrl` and `email` are not
 * brands, so they use real lucide icons.
 */

/** A `Globe`-style icon component, or an inline path. One row of the social strip. */
type SocialGlyph = { kind: "icon"; Icon: typeof Globe } | { kind: "path"; d: string };

const LINKEDIN_PATH = "M5.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.8 9h3.4v11H3.8V9Zm5.7 0h3.3v1.5c.5-.9 1.7-1.8 3.5-1.8 3.6 0 4.3 2.4 4.3 5.4V20h-3.4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H9.5V9Z";
const X_PATH = "M4 4h4.3l3.9 5.4L16.9 4H20l-6.3 7.2L20.5 20h-4.3l-4.2-5.8L6.9 20H3.8l6.7-7.6L4 4Zm2.9 1.5 9.4 13h1.4L8.4 5.5H6.9Z";

export interface AuthorCardAuthor {
  name: string;
  slug: string;
  role?: string | null;
  bio?: string | null;
  avatar?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
}

export interface AuthorCardProps {
  author: AuthorCardAuthor;
  /** `dark` sits on the navy hero of the author archive; `light` is the white end-of-article card. */
  tone?: "light" | "dark";
  /**
   * Show the "More from …" button. Off on the author's own archive, where it would link to the
   * page the reader is already on.
   */
  showMore?: boolean;
  className?: string;
}

export function AuthorCard({ author, tone = "light", showMore = true, className }: AuthorCardProps) {
  const dark = tone === "dark";
  const links: { key: string; label: string; href: string; glyph: SocialGlyph }[] = [];
  if (author.linkedinUrl) links.push({ key: "linkedin", label: "LinkedIn", href: author.linkedinUrl, glyph: { kind: "path", d: LINKEDIN_PATH } });
  if (author.twitterUrl) links.push({ key: "twitter", label: "X, formerly Twitter", href: author.twitterUrl, glyph: { kind: "path", d: X_PATH } });
  if (author.websiteUrl) links.push({ key: "website", label: "Website", href: author.websiteUrl, glyph: { kind: "icon", Icon: Globe } });
  // An author's email is already public on the record; `mailto:` is the only non-http destination
  // here, so it is built separately rather than being filtered by the http test below.
  if (author.email) links.push({ key: "email", label: "Email", href: `mailto:${author.email}`, glyph: { kind: "icon", Icon: Mail } });

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5", !dark && "card card-p", className)}>
      <Avatar name={author.name} src={author.avatar} size={64} className={cn("shrink-0", dark ? "ring-2 ring-white/25" : "ring-4 ring-lavender")} />

      <div className="min-w-0 flex-1">
        <p className={cn("text-overline", dark ? "text-white/60" : "text-muted")}>Written by</p>
        <p className={cn("mt-0.5 text-h3", dark ? "text-white" : "text-navy")}>{author.name}</p>
        {author.role && <p className={cn("text-body-sm font-medium", dark ? "text-orange-light" : "text-orange")}>{author.role}</p>}
        {author.bio && <p className={cn("mt-2 text-body", dark ? "text-white/80" : "text-muted")}>{author.bio}</p>}

        {(links.length > 0 || showMore) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {links.length > 0 && (
              <ul className="flex flex-wrap items-center gap-2" aria-label={`${author.name} elsewhere`}>
                {links.map((l) => {
                  const external = /^https?:\/\//i.test(l.href);
                  // Lifted into its own binding so the discriminant below narrows a plain local
                  // reference rather than a two-deep property path.
                  const glyph = l.glyph;
                  return (
                    <li key={l.key}>
                      <a
                        href={l.href}
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        aria-label={external ? `${author.name} on ${l.label} (opens in a new tab)` : `Email ${author.name}`}
                        className={cn(
                          // `relative` anchors the ::after that pads the 36px circle back out to a
                          // 44px target. Deliberately NOT overflow-hidden — that clips it away.
                          "ring-focus relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-micro tap-highlight-none after:absolute after:-inset-1 after:rounded-full after:content-[''] motion-reduce:transition-none",
                          dark ? "border-white/25 bg-white/10 text-white ring-focus-inverse hover:bg-white/20" : "border-line bg-white text-navy hover:bg-lavender"
                        )}
                      >
                        {glyph.kind === "icon" ? (
                          <glyph.Icon className="h-4 w-4" aria-hidden />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                            <path d={glyph.d} />
                          </svg>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {showMore && (
              <ButtonLink href={`/blog/author/${author.slug}`} variant={dark ? "white" : "outline"} size="sm">
                More from {author.name}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
