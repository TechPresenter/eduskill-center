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
 * Phones get the chips as a single edge-to-edge snap row (`hscroll`) rather than a wrapped block
 * four rows tall; from `sm` up they wrap normally. Every chip is a 44px target.
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

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-center lg:justify-between lg:gap-6">
        <div className="w-full lg:max-w-xs lg:shrink-0">
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <Input id="course-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" leftIcon={<Search className="h-4 w-4" />} />
        </div>

        {/* hscroll below sm, a wrapping row above it. */}
        <div className="hscroll gap-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Filter by category">
          {chips.map((c) => {
            const active = category === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCategory(c.slug)}
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

      <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
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
