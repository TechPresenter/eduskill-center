"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/ui/file-upload";
import { api } from "@/lib/api-client";

/**
 * Tags for a post, with the tags the blog already uses offered as one-tap chips.
 *
 * `Blog.tags` stays a plain `String[]`; `BlogTag` is a lookup table that holds the canonical
 * label, a slug, per-tag SEO copy and a live post count. That means the array and the table can
 * only stay aligned if the label written into the array matches the stored row EXACTLY — so this
 * control normalises on the way in (trim, collapse runs of whitespace, cap at 60 characters, drop
 * case-insensitive duplicates) and, when a tag already exists, rewrites the author's spelling to
 * the stored casing. Typing "ai" when the blog already uses "AI" reuses "AI" rather than creating
 * a second tag that renders as a separate archive page.
 *
 * It never blocks a brand-new tag: the suggestion list is a shortcut, not a vocabulary.
 */

interface BlogTagRow {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

/** Same normalisation as `normalizeTagLabel` in `@/server/blog`, applied before the round trip. */
function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 60);
}

const MAX_SUGGESTIONS = 12;

export function BlogTagField({ value, onChange, disabled }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const [known, setKnown] = React.useState<BlogTagRow[]>([]);

  // Fetched once, and quietly: suggestions are a convenience. A staff member without `cms.view`
  // never reaches this screen, but a 404 while the endpoint is being deployed must not put a red
  // toast on a form that is working perfectly well without it.
  React.useEffect(() => {
    let alive = true;
    api
      .get<BlogTagRow[]>("/api/admin/blog/tags")
      .then((rows) => {
        if (alive && Array.isArray(rows)) setKnown(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** lowercased label → the casing actually stored in `BlogTag.name`. */
  const canonical = React.useMemo(() => new Map(known.map((t) => [t.name.toLowerCase(), t.name])), [known]);
  const chosen = React.useMemo(() => new Set(value.map((t) => t.toLowerCase())), [value]);

  const commit = (next: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of next) {
      const label = normalizeLabel(raw);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(canonical.get(key) ?? label);
    }
    onChange(out);
  };

  const suggestions = known.filter((t) => !chosen.has(t.name.toLowerCase())).slice(0, MAX_SUGGESTIONS);

  return (
    <div className="space-y-3">
      {/* TagInput has no `disabled` prop of its own; a disabled fieldset disables every control
          inside it natively, which is what a read-only form needs. */}
      <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
        <TagInput value={value} onChange={commit} placeholder="Type a tag and press Enter" />
      </fieldset>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p id="blog-tag-suggestions" className="text-caption text-muted">
            Tags already used on the blog — tap to add one:
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-labelledby="blog-tag-suggestions">
            {suggestions.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => commit([...value, t.name])}
                  aria-label={`Add the tag ${t.name}`}
                  className="press-scale ring-focus inline-flex min-h-11 items-center rounded-full disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
                >
                  <Badge tone="neutral" className="gap-1 md:hover:border-navy/30 md:hover:bg-lavender">
                    <Plus className="h-3 w-3" aria-hidden />
                    {t.name}
                    {t.postCount > 0 && <span className="font-normal text-muted/80 tabular-nums">{t.postCount}</span>}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
