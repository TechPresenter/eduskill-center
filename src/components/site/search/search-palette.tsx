"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CornerDownLeft, History, MapPin, Mail, Search, SearchX, X } from "lucide-react";
import type { SearchGroups, SearchResult, SearchResultType } from "@/server/search";
import { OverlaySurface } from "@/components/ui/bottom-sheet";
import { ButtonLink } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { GROUP_LABELS, QUICK_LINKS, ResultRow, ResultRowSkeleton, type RowKind } from "@/components/site/search/result-row";
import { addRecentSearch, clearRecentSearches, removeRecentSearch, useRecentSearches } from "@/components/site/search/recent-searches";
import { useSiteSearch } from "@/components/site/search/use-site-search";
import type { LucideIcon } from "lucide-react";

/*
 * The site search overlay.
 *  - Phones (< sm): a full-screen sheet that slides up (350ms), input pinned at the top behind a back
 *    arrow, results as 56px app list rows underneath. Pinned at the top, the input can never sit
 *    under the on-screen keyboard.
 *  - sm and up: a command palette dialog anchored near the top of the viewport.
 * Both are the one OverlaySurface core (portal, focus trap, scroll lock, Escape, focus return to the
 * trigger), so it behaves like every other overlay in the product.
 *
 * ARIA: the input is a combobox that owns a listbox of options (the result links). Focus never
 * leaves the input while arrowing; aria-activedescendant points at the highlighted row.
 */

interface Option {
  key: string;
  kind: RowKind;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  icon?: LucideIcon;
  /** Recent-search rows re-run the query instead of navigating. */
  recent?: string;
}

interface Section {
  key: string;
  label: string;
  options: Option[];
}

const GROUP_ORDER: { type: SearchResultType; field: keyof Pick<SearchGroups, "courses" | "centres" | "programs" | "faqs"> }[] = [
  { type: "centre", field: "centres" },
  { type: "course", field: "courses" },
  { type: "program", field: "programs" },
  { type: "faq", field: "faqs" },
];

const PIN_RE = /^\d{6}$/;

export function searchPageHref(query: string) {
  return `/search?q=${encodeURIComponent(query)}`;
}

function toOption(r: SearchResult): Option {
  return { key: `${r.type}-${r.id}`, kind: r.type, title: r.title, subtitle: r.subtitle, meta: r.meta, href: r.href };
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const recents = useRecentSearches();
  const { query, status, data, stale, retry } = useSiteSearch(input, { enabled: open });
  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Fresh palette every time it opens (derived-state reset, no effect).
  const [lastOpen, setLastOpen] = React.useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setInput("");
      setActiveIndex(-1);
    }
  }

  // A new query drops the keyboard highlight, so Enter means "see all results" until the user arrows.
  const [lastQuery, setLastQuery] = React.useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setActiveIndex(-1);
  }

  const typing = query.length >= 2;

  const sections: Section[] = React.useMemo(() => {
    if (!typing) {
      const out: Section[] = [];
      if (recents.length > 0) {
        out.push({
          key: "recent",
          label: "Recent searches",
          options: recents.map((r) => ({ key: `recent-${r}`, kind: "recent", title: r, href: searchPageHref(r), icon: History, recent: r })),
        });
      }
      out.push({
        key: "quick",
        label: "Popular",
        options: QUICK_LINKS.map((q) => ({ key: `quick-${q.href}`, kind: "quick", title: q.label, subtitle: q.subtitle, href: q.href, icon: q.icon })),
      });
      return out;
    }
    if (!data) return [];
    const out: Section[] = GROUP_ORDER.filter((g) => data[g.field].length > 0).map((g) => ({
      key: g.type,
      label: GROUP_LABELS[g.type],
      options: data[g.field].map(toOption),
    }));
    if (data.total > 0) {
      out.push({
        key: "all",
        label: "More",
        options: [{ key: "all", kind: "all", title: `See all results for “${query}”`, subtitle: "Open the full results page", href: searchPageHref(query) }],
      });
    }
    return out;
  }, [typing, recents, data, query]);

  const flat = React.useMemo(() => sections.flatMap((s) => s.options), [sections]);
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const activeId = activeIndex >= 0 && activeIndex < flat.length ? optionId(activeIndex) : undefined;

  // Keep the highlighted row visible while arrowing through a long list.
  React.useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const go = React.useCallback(
    (href: string, remember?: string) => {
      if (remember) addRecentSearch(remember);
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const choose = (opt: Option) => {
    if (opt.recent) {
      setInput(opt.recent);
      inputRef.current?.focus();
      return;
    }
    go(opt.href, typing ? query : undefined);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (flat.length === 0) return;
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => {
        if (i < 0) return dir === 1 ? 0 : flat.length - 1;
        return (i + dir + flat.length) % flat.length;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = activeIndex >= 0 ? flat[activeIndex] : undefined;
      if (opt) choose(opt);
      else if (typing) go(searchPageHref(query), query);
    }
  };

  const hasResults = typing && data !== null && data.total > 0;
  const expanded = flat.length > 0;
  const announcement =
    status === "loading" ? "Searching…" : status === "error" ? "Search is unavailable right now." : status === "success" && data ? (data.total === 0 ? `No results for ${query}.` : `${data.total} result${data.total === 1 ? "" : "s"} available. Use the up and down arrows to review.`) : "";

  // Index of each section's first option in the flat (keyboard) order.
  const offsets = sections.map((_, i) => sections.slice(0, i).reduce((n, s) => n + s.options.length, 0));
  const pinQuery = PIN_RE.test(query.replace(/\s+/g, ""));

  return (
    <OverlaySurface
      open={open}
      onClose={onClose}
      phone="sheet"
      desktop="dialog"
      height="full"
      hideClose
      aria-label="Search the site"
      initialFocus="first"
      widthClassName="sm:max-w-2xl"
      className="bg-white sm:h-auto sm:max-h-[min(80dvh,40rem)] sm:self-start sm:mt-[10vh] sm:overflow-hidden"
      bodyClassName="flex flex-col p-0"
    >
      <form
        role="search"
        action={withBasePath("/search")}
        method="get"
        onSubmit={(e) => e.preventDefault()}
        className="sticky top-0 z-raised shrink-0 border-b border-line bg-white"
      >
        <div className="flex h-16 items-center gap-1 px-2 sm:gap-2 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="touch-target inline-flex shrink-0 items-center justify-center rounded-md text-navy tap-highlight-none transition-colors duration-micro active:bg-surface ring-focus motion-reduce:transition-none sm:hidden"
          >
            <ArrowLeft className="h-6 w-6" aria-hidden />
          </button>
          <Search className="hidden h-5 w-5 shrink-0 text-navy sm:block" aria-hidden />
          <label htmlFor={`${baseId}-input`} className="sr-only">
            Search courses, training centres, programs and FAQs
          </label>
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            name="q"
            type="search"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-describedby={`${baseId}-hint`}
            // Opened by a tap or Ctrl K, so focusing the field is what the visitor asked for; doing it
            // on mount keeps the phone keyboard opening inside the same user gesture.
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={80}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search courses, centres, PIN…"
            className="h-12 min-w-0 flex-1 bg-transparent px-2 text-input text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="touch-target inline-flex shrink-0 items-center justify-center rounded-md text-muted tap-highlight-none transition-colors duration-micro hover:text-ink active:bg-surface ring-focus motion-reduce:transition-none"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
          {/* The dialog's visible close control from sm up (tablets have no Esc key); the back arrow does this on phones. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="hidden h-9 shrink-0 items-center justify-center rounded-md px-1 text-muted ring-focus pointer-coarse:h-11 pointer-coarse:min-w-11 sm:inline-flex"
          >
            <kbd className="rounded-xs border border-line bg-surface px-1.5 py-0.5 font-sans text-caption text-muted">Esc</kbd>
          </button>
        </div>
        <p id={`${baseId}-hint`} className="sr-only">
          Type at least two letters. Use the arrow keys to move through results and Enter to open one, or press Enter to see all results.
        </p>
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="flex-1 px-2 pt-1 pb-4 sm:px-3">
        {typing && status === "error" && (
          <div className="mx-2 mt-3 flex items-start gap-3 rounded-lg bg-danger-light/50 px-3 py-3 text-body-sm text-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <p className="min-w-0 flex-1">Search is unavailable right now. Check your connection and try again.</p>
            <button type="button" onClick={retry} className="-my-2 min-h-11 shrink-0 rounded-md px-2 font-semibold text-orange ring-focus">
              Retry
            </button>
          </div>
        )}

        {typing && status === "loading" && !data && (
          <div className="pt-3">
            <ResultRowSkeleton count={4} />
          </div>
        )}

        {typing && status === "success" && data && data.total === 0 && (
          <div className="flex flex-col items-center px-4 py-10 text-center animate-fade-in motion-reduce:animate-none">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-lavender text-navy">
              <SearchX className="h-7 w-7" aria-hidden />
            </span>
            <p className="text-h4 text-navy">No matches for “{query}”</p>
            <p className="mt-1.5 max-w-sm text-body-sm text-muted">
              {pinQuery
                ? "We don't have a centre listed at this PIN code yet. The centre finder can show the nearest ones in your district."
                : "Try a course name, a district, a centre code or a 6-digit PIN code."}
            </p>
            <div className="mt-5 grid w-full max-w-sm grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <ButtonLink href={pinQuery ? `/training-centers?q=${encodeURIComponent(query)}` : "/training-centers"} variant="navy" size="md" onClick={onClose} leftIcon={<MapPin className="h-4 w-4" />}>
                Centre finder
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="md" onClick={onClose} leftIcon={<Mail className="h-4 w-4" />}>
                Contact us
              </ButtonLink>
            </div>
          </div>
        )}

        {!typing && query.length === 1 && <p className="px-3 pt-3 text-body-sm text-muted">Keep typing — search starts at two letters.</p>}

        {sections.length > 0 && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={typing ? `Results for ${query}` : "Suggestions"}
            aria-busy={stale || undefined}
            className={cn("transition-opacity duration-micro motion-reduce:transition-none", stale && "opacity-60")}
          >
            {sections.map((section, sectionIndex) => (
              <div key={section.key} role="group" aria-labelledby={`${baseId}-${section.key}`} className="pt-2 animate-fade-in motion-reduce:animate-none">
                <div className="flex min-h-9 items-center justify-between px-3">
                  <p id={`${baseId}-${section.key}`} className="text-overline text-muted">
                    {section.label}
                  </p>
                  {section.key === "recent" && (
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches();
                        inputRef.current?.focus();
                      }}
                      className="-mr-1 min-h-11 rounded-md px-2 text-body-sm font-semibold text-orange ring-focus sm:min-h-9"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {section.options.map((opt, i) => {
                    const index = offsets[sectionIndex] + i;
                    const isActive = index === activeIndex;
                    return (
                      <div key={opt.key} role="presentation" className="relative">
                        <ResultRow
                          id={optionId(index)}
                          role="option"
                          aria-selected={isActive}
                          tabIndex={-1}
                          href={opt.href}
                          kind={opt.kind}
                          icon={opt.icon}
                          title={opt.title}
                          subtitle={opt.subtitle}
                          meta={opt.meta}
                          query={hasResults && opt.kind !== "all" ? query : undefined}
                          active={isActive}
                          prefetch={false}
                          onMouseMove={() => {
                            if (activeIndex !== index) setActiveIndex(index);
                          }}
                          onClick={(e) => {
                            // Modified clicks (new tab / window) keep the browser's default behaviour.
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault();
                            choose(opt);
                          }}
                          className={opt.recent ? "pr-14" : undefined}
                        />
                        {opt.recent && (
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Remove “${opt.recent}” from recent searches`}
                            onClick={() => {
                              removeRecentSearch(opt.recent!);
                              inputRef.current?.focus();
                            }}
                            className="touch-target absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-ink active:bg-surface"
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 hidden shrink-0 items-center gap-4 border-t border-line bg-white px-5 py-2.5 text-caption text-muted sm:flex">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>
            <CornerDownLeft className="h-3 w-3" aria-hidden />
            <span className="sr-only">Enter</span>
          </Kbd>
          to open
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <Kbd>Esc</Kbd> to close
        </span>
      </div>
    </OverlaySurface>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-6 items-center justify-center rounded-xs border border-line bg-surface px-1.5 py-0.5 font-sans text-caption text-ink">{children}</kbd>;
}
