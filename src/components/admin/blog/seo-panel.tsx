"use client";

import * as React from "react";
import { ChevronDown, Globe, Share2 } from "lucide-react";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { MediaPlaceholder } from "@/components/site/safe-image";
import { useHydrated, useIsDesktop } from "@/lib/hooks";
import { cn, slugify, truncate } from "@/lib/utils";
import { CoverImageField } from "@/components/admin/blog/cover-image-field";
import type { BlogFormValues } from "@/components/admin/blog/types";

/**
 * Everything that decides how the article looks OFF the website: the Google result, the link
 * preview when it is shared, the canonical address and whether it should be indexed at all.
 *
 * Two deliberate departures from the generic editor's preview panel:
 *
 * 1. It is available AT EVERY WIDTH. `ContentEditor`'s live preview is `hidden xl:block`, which
 *    means nobody editing on a laptop, a tablet or a phone has ever seen it. Here the same
 *    information is a card on `lg+` and a disclosure below it — collapsed by default on a phone
 *    so it does not bury the Save button, but reachable.
 * 2. The character counters are paired with words, never colour alone (WCAG 1.4.1), and are
 *    `aria-live="polite"` so a screen-reader user hears "62 of 60 characters — getting long"
 *    instead of watching a number turn amber.
 */

const SEO_KEYS = ["seoTitle", "seoDescription", "canonicalUrl", "ogImage", "noIndex"] as const;

export interface SeoPanelProps {
  values: BlogFormValues;
  onChange: (patch: Partial<BlogFormValues>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

/** Length readout: number, limit, and a plain-language verdict. Colour is the third signal, not the first. */
function Counter({ id, length, limit, hard }: { id: string; length: number; limit: number; hard: number }) {
  const verdict = length > hard ? "too long — it will be cut off" : length > limit ? "getting long" : null;
  return (
    <span id={id} aria-live="polite" className={cn("tabular-nums", length > hard ? "font-semibold text-danger" : length > limit ? "font-semibold text-warning-dark" : "text-muted")}>
      {length}/{limit} characters{verdict ? ` · ${verdict}` : ""}
    </span>
  );
}

/**
 * The host, read once the component has hydrated — `APP_URL` is a server-only variable and would
 * not match on the client, so the preview says "your site" for the first paint and the real host
 * from then on.
 */
function useHost(): string {
  return useHydrated() ? window.location.host : "";
}

export function SeoPanel({ values, onChange, errors = {}, disabled }: SeoPanelProps) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);
  const host = useHost();

  const hasError = SEO_KEYS.some((k) => !!errors[k]);
  /**
   * A failed save must never leave its error inside a collapsed panel, so the panel opens itself
   * the moment errors appear. Adjusting state during render (guarded by the previous value) rather
   * than from an effect: React re-runs this render before touching the DOM, so the panel is never
   * painted collapsed-with-errors — and it is one pass, not two.
   */
  const [errorsWereShowing, setErrorsWereShowing] = React.useState(hasError);
  if (hasError !== errorsWereShowing) {
    setErrorsWereShowing(hasError);
    // Only ever opens. Closing it again is the editor's call, and it stays closed.
    if (hasError) setOpen(true);
  }

  // `useIsDesktop` server-renders `true`, so the desktop card is never hidden on first paint; a
  // phone collapses the panel once on hydration, which is the cheaper of the two flashes.
  const expanded = isDesktop || open;

  const slug = values.slug.trim() || slugify(values.title) || "your-address";
  const title = values.seoTitle.trim() || values.title.trim() || "Untitled post";
  const description = values.seoDescription.trim() || values.excerpt.trim();
  const social = values.ogImage.trim() || values.coverImage.trim();

  return (
    <section className="card card-p" aria-labelledby="blog-seo-heading">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <h3 id="blog-seo-heading" className="text-h4 text-navy">
            Search &amp; social
          </h3>
          <p className="mt-1 text-sm text-muted">How this article looks on Google and when somebody shares the link.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={expanded}
          aria-controls="blog-seo-body"
          className="ring-focus -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-body-sm font-semibold text-navy tap-highlight-none lg:hidden"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-micro motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
        </button>
      </div>

      <div id="blog-seo-body" hidden={!expanded} className="space-y-5 pt-4">
        <Field
          label="Search engine title"
          htmlFor="blog-seo-title"
          error={errors.seoTitle}
          hint={
            <>
              Leave empty to use the post title. <Counter id="blog-seo-title-count" length={values.seoTitle.length} limit={60} hard={70} />
            </>
          }
        >
          <Input id="blog-seo-title" value={values.seoTitle} onChange={(e) => onChange({ seoTitle: e.target.value })} maxLength={200} invalid={!!errors.seoTitle} disabled={disabled} placeholder={values.title || "e.g. Why digital literacy is the first step"} />
        </Field>

        <Field
          label="Search engine description"
          htmlFor="blog-seo-description"
          error={errors.seoDescription}
          hint={
            <>
              Leave empty to use the excerpt. The field accepts up to 400 characters, but Google usually shows about 160.{" "}
              <Counter id="blog-seo-description-count" length={values.seoDescription.length} limit={160} hard={200} />
            </>
          }
        >
          <Textarea id="blog-seo-description" value={values.seoDescription} onChange={(e) => onChange({ seoDescription: e.target.value })} rows={3} maxLength={400} invalid={!!errors.seoDescription} disabled={disabled} />
        </Field>

        <Field label="Original address (canonical)" htmlFor="blog-canonical-url" error={errors.canonicalUrl} hint="Only if this article was first published somewhere else.">
          <Input
            id="blog-canonical-url"
            type="url"
            inputMode="url"
            value={values.canonicalUrl}
            onChange={(e) => onChange({ canonicalUrl: e.target.value })}
            maxLength={500}
            placeholder="https://example.org/the-original-article"
            invalid={!!errors.canonicalUrl}
            disabled={disabled}
            className="font-mono"
          />
        </Field>

        <CoverImageField
          value={values.ogImage}
          onChange={(url) => onChange({ ogImage: url })}
          folder="blog/og"
          label="Social preview image"
          hint="1200×630 works best. Falls back to the cover image."
          error={errors.ogImage}
          disabled={disabled}
        />

        <Checkbox checked={values.noIndex} onChange={(e) => onChange({ noIndex: e.target.checked })} disabled={disabled} label="Hide from Google" description="The article stays on the website, but search engines are asked not to list it and it is left out of the sitemap." />

        {/* ── Previews ── */}
        <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <section aria-labelledby="blog-serp-preview" className="min-w-0 space-y-1">
            <h4 id="blog-serp-preview" className="mb-2 flex items-center gap-2 text-overline text-muted">
              <Globe className="h-4 w-4" aria-hidden /> Google result
            </h4>
            <p className="truncate font-mono text-caption text-success-dark">
              {host || "your site"}/blog/{slug}
            </p>
            <p className="text-body font-semibold break-words text-navy-light">{truncate(title, 70)}</p>
            <p className="text-body-sm text-muted">{description ? truncate(description, 160) : "Search engines will pick text from the page."}</p>
            {values.noIndex && <p className="text-caption font-semibold text-warning-dark">Hidden from Google — this result will not appear.</p>}
          </section>

          <section aria-labelledby="blog-social-preview" className="min-w-0">
            <h4 id="blog-social-preview" className="mb-2 flex items-center gap-2 text-overline text-muted">
              <Share2 className="h-4 w-4" aria-hidden /> Shared link
            </h4>
            <div className="overflow-hidden rounded-card border border-line bg-white">
              <span className="media media-16x9 block">
                {social ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={social} alt="" loading="lazy" decoding="async" />
                ) : (
                  <MediaPlaceholder seed={slug} mark={values.title || "Blog"} />
                )}
              </span>
              <div className="space-y-1 p-3">
                <p className="truncate text-caption text-muted uppercase">{host || "your site"}</p>
                <p className="text-body-sm font-semibold break-words text-navy">{truncate(title, 70)}</p>
                <p className="text-caption text-muted">{description ? truncate(description, 110) : "No description yet."}</p>
              </div>
            </div>
            {!values.ogImage && !values.coverImage && <p className="mt-1.5 text-caption text-muted">With no image at all, the link preview falls back to the site-wide social image from Settings.</p>}
          </section>
        </div>
      </div>
    </section>
  );
}
