"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Search, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconTile, ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/feedback";
import { api } from "@/lib/api-client";
import type { RelatedOption } from "@/components/admin/blog/types";

/**
 * Manual "related articles" pins — up to three, in the order they should appear.
 *
 * Pins are the FIRST source the public page uses; it then falls back to same category, then
 * shared tags, then recency. So this control is for the handful of posts where an editor knows
 * the sequel, not something anyone has to fill in.
 *
 * Only the ids are stored (`Blog.relatedPostIds`), so the titles have to come from somewhere:
 * `initial` seeds the catalogue with the posts already pinned (loaded server-side by the page),
 * and search results are merged into it as they arrive. Without that, editing an existing post
 * would show three opaque uuids.
 */

const MAX_PINS = 3;
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export interface RelatedPickerProps {
  /** Pinned post ids, in display order. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Titles for the ids already in `value` (and anything else worth pre-labelling). */
  initial?: RelatedOption[];
  /** The post being edited — it can never be related to itself. */
  excludeId?: string;
  disabled?: boolean;
  /** Id of the search input, so the form's ErrorSummary can jump to it. */
  inputId?: string;
  error?: string;
}

export function RelatedPicker({ value, onChange, initial = [], excludeId, disabled, inputId = "blog-related-search", error }: RelatedPickerProps) {
  const [query, setQuery] = React.useState("");
  /**
   * The last search that finished, TAGGED WITH THE TERM IT ANSWERS. Keeping the term beside the
   * items is what lets "are we still waiting?" and "is there anything to show?" be derived during
   * render instead of being pushed into two more state variables from inside the effect — a
   * synchronous setState in an effect is an extra render pass for something the render already
   * knows (and is what `react-hooks/set-state-in-effect` objects to).
   */
  const [search, setSearch] = React.useState<{ term: string; items: RelatedOption[] } | null>(null);
  const [catalog, setCatalog] = React.useState<Record<string, RelatedOption>>(() => Object.fromEntries(initial.map((p) => [p.id, p])));

  const full = value.length >= MAX_PINS;

  const term = query.trim();
  const searchable = term.length >= MIN_QUERY;
  // Answers for an older term are not results for this one, so a keystroke puts the spinner back
  // without any state having to be cleared.
  const results = searchable && search?.term === term ? search.items : null;
  const searching = searchable && results === null;

  // Debounced search. `alive` guards both the timer and the in-flight request, so a fast typist
  // can never have an older response overwrite a newer one.
  React.useEffect(() => {
    const t = query.trim();
    if (t.length < MIN_QUERY) return;
    let alive = true;
    const timer = setTimeout(() => {
      api
        .get<{ items: RelatedOption[] }>(`/api/admin/blog?limit=8&status=PUBLISHED&q=${encodeURIComponent(t)}`)
        .then((res) => {
          if (!alive) return;
          const items = res?.items ?? [];
          setSearch({ term: t, items });
          setCatalog((c) => ({ ...c, ...Object.fromEntries(items.map((p) => [p.id, { id: p.id, title: p.title, slug: p.slug }])) }));
        })
        .catch(() => {
          // A failed request still answers this term — with nothing. Leaving it pending would spin
          // for ever.
          if (alive) setSearch({ term: t, items: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const add = (post: RelatedOption) => {
    if (full || value.includes(post.id) || post.id === excludeId) return;
    setCatalog((c) => ({ ...c, [post.id]: post }));
    onChange([...value, post.id]);
    setQuery("");
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  const visibleResults = (results ?? []).filter((p) => p.id !== excludeId && !value.includes(p.id));

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <ListGroup aria-label="Pinned related articles">
          {value.map((id, i) => {
            const post = catalog[id];
            return (
              <ListRow
                key={id}
                leading={<IconTile tone="lavender">{i + 1}</IconTile>}
                title={post?.title ?? "This post is no longer available"}
                description={post ? `/blog/${post.slug}` : id}
                clamp={1}
                actions={
                  disabled ? undefined : (
                    <>
                      <IconButton size="sm" icon={<ArrowUp className="h-4 w-4" />} aria-label={`Move ${post?.title ?? "this article"} up`} onClick={() => move(i, -1)} disabled={i === 0} />
                      <IconButton size="sm" icon={<ArrowDown className="h-4 w-4" />} aria-label={`Move ${post?.title ?? "this article"} down`} onClick={() => move(i, 1)} disabled={i === value.length - 1} />
                      <IconButton
                        size="sm"
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label={`Remove ${post?.title ?? "this article"}`}
                        className="hover:bg-danger-light hover:text-danger"
                        onClick={() => onChange(value.filter((v) => v !== id))}
                      />
                    </>
                  )
                }
              />
            );
          })}
        </ListGroup>
      )}

      <Field
        label="Find an article to pin"
        htmlFor={inputId}
        error={error}
        hint={full ? "Three is the maximum. Remove one to pin a different article." : "Leave empty and the site picks by category, then shared tags, then recency."}
      >
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Search published posts by title"
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          rightIcon={searching ? <Spinner className="h-4 w-4" /> : undefined}
          disabled={disabled || full}
          autoComplete="off"
        />
      </Field>

      {/* Results only appear once there is something to show — an empty panel under the input on
          every keystroke is noise. */}
      {results !== null && (
        <div aria-live="polite">
          {visibleResults.length === 0 ? (
            <p className="text-body-sm text-muted">No other published post matches &ldquo;{term}&rdquo;.</p>
          ) : (
            <ListGroup aria-label="Search results">
              {visibleResults.map((p) => (
                <ListRow key={p.id} title={p.title} description={`/blog/${p.slug}`} clamp={1} onClick={() => add(p)} chevron={false} trailing="Pin" aria-label={`Pin ${p.title}`} />
              ))}
            </ListGroup>
          )}
        </div>
      )}
    </div>
  );
}
