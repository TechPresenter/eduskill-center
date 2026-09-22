"use client";

import * as React from "react";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { CourseCard } from "@/components/site/course-card";
import type { PublicCourseCard } from "@/server/public";
import { cn } from "@/lib/utils";

/**
 * Client-side filterable course grid (category chips + search).
 *
 * Below `lg` the search field and the chips form one sticky bar under the app bar, the chips as a
 * single edge-to-edge snap row (`hscroll`) rather than a wrapped block four rows tall; from `lg` up
 * it is an inline toolbar and the chips wrap. Every chip is a 44px target.
 */
export function CourseCatalog({ courses, categories, applyHrefs, initialCategory }: { courses: PublicCourseCard[]; categories: { id: string; name: string; slug: string }[]; applyHrefs: Record<string, string>; initialCategory?: string }) {
  const [category, setCategory] = React.useState<string>(initialCategory && categories.some((c) => c.slug === initialCategory) ? initialCategory : "all");
  const [q, setQ] = React.useState("");

  const needle = q.trim().toLowerCase();
  const visible = courses.filter((c) => {
    if (category !== "all" && c.category?.slug !== category) return false;
    if (needle) {
      return c.name.toLowerCase().includes(needle) || (c.shortDescription ?? "").toLowerCase().includes(needle) || (c.category?.name ?? "").toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle);
    }
    return true;
  });

  const filtered = category !== "all" || needle.length > 0;
  const reset = () => {
    setCategory("all");
    setQ("");
  };

  const chips = [{ id: "all", name: "All courses", slug: "all" }, ...categories];

  /** Start of the results. Changing category deep in the list brings the (shorter) list back into view. */
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const pickCategory = (slug: string) => {
    setCategory(slug);
    const el = resultsRef.current;
    // Only when the results' start has scrolled up under the sticky chrome (its scroll-margin).
    if (el && el.getBoundingClientRect().top < (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  };

  return (
    <div>
      {/*
        Phones and tablets: the search + chips bar is the first thing on the page and sticks under
        the site app bar while the list scrolls, so filtering is always one tap away. The negative
        top margin cancels most of the host section's rhythm padding (the compact page header above
        already separates it), and the bar bleeds to the screen edges with its own white fill and
        hairline. Solid fill, no backdrop blur: it sits over scrolling content. From lg up it is the
        ordinary inline toolbar.
      */}
      <div
        className={cn(
          "sticky z-sticky -mx-4 -mt-16 flex flex-col gap-3 border-b border-line bg-white px-4 pt-4 pb-3 sm:-mx-6 sm:-mt-20 sm:px-6",
          // 3.5rem = the site app bar row (h-14 below lg, like the portal app bar), plus the notch inset.
          "top-[calc(var(--site-header-h,3.5rem)+env(safe-area-inset-top,0px))]",
          "lg:static lg:mx-0 lg:mt-0 lg:flex-row-reverse lg:items-center lg:justify-between lg:gap-6 lg:border-0 lg:bg-transparent lg:p-0"
        )}
      >
        <div className="w-full lg:max-w-xs lg:shrink-0">
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <Input id="course-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" leftIcon={<Search className="h-4 w-4" />} />
        </div>

        {/* One swipeable row inside the sticky bar (hscroll is position:relative, so it cannot widen
            the page); a wrapping row from lg up, where the bar is no longer sticky. */}
        <div className="hscroll gap-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0" role="group" aria-label="Filter by category">
          {chips.map((c) => {
            const active = category === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => pickCategory(c.slug)}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-micro tap-highlight-none ring-focus motion-reduce:transition-none",
                  active ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40 hover:bg-lavender"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* scroll-margin clears the sticky app bar + filter bar when pickCategory scrolls here. */}
      <div ref={resultsRef} className="mt-3 mb-4 flex min-h-11 scroll-mt-52 lg:scroll-mt-28 flex-wrap items-center justify-between gap-3 lg:mt-6 lg:mb-6 lg:border-t lg:border-line lg:pt-4">
        <p className="text-body-sm text-muted" aria-live="polite">
          Showing <span className="font-semibold text-ink tabular-nums">{visible.length}</span> of <span className="tabular-nums">{courses.length}</span> courses
        </p>
        {filtered && (
          <Button type="button" variant="link" size="sm" onClick={reset}>
            Clear filters
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-7 w-7" />}
          title="No courses match"
          description="Try a different keyword, or clear the filters to see the full catalogue."
          action={
            <Button type="button" variant="outline" onClick={reset}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} applyHref={applyHrefs[c.id] ?? "/register"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
