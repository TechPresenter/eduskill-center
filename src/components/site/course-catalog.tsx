"use client";

import * as React from "react";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { CourseCard } from "@/components/site/course-card";
import type { PublicCourseCard } from "@/server/public";
import { cn } from "@/lib/utils";

/** Client-side filterable course grid (category chips + search). */
export function CourseCatalog({ courses, categories, applyHrefs, initialCategory }: { courses: PublicCourseCard[]; categories: { id: string; name: string; slug: string }[]; applyHrefs: Record<string, string>; initialCategory?: string }) {
  const [category, setCategory] = React.useState<string>(initialCategory && categories.some((c) => c.slug === initialCategory) ? initialCategory : "all");
  const [q, setQ] = React.useState("");

  const visible = courses.filter((c) => {
    if (category !== "all" && c.category?.slug !== category) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      return c.name.toLowerCase().includes(needle) || (c.shortDescription ?? "").toLowerCase().includes(needle) || (c.category?.name ?? "").toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle);
    }
    return true;
  });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {[{ id: "all", name: "All courses", slug: "all" }, ...categories].map((c) => (
            <button key={c.slug} type="button" onClick={() => setCategory(c.slug)} aria-pressed={category === c.slug} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", category === c.slug ? "bg-navy text-white" : "bg-lavender text-navy hover:bg-navy-soft")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="w-full lg:max-w-xs">
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <Input id="course-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" leftIcon={<Search className="h-4 w-4" />} />
        </div>
      </div>
      <p className="mb-4 text-sm text-muted" aria-live="polite">
        Showing {visible.length} of {courses.length} courses
      </p>
      {visible.length === 0 ? (
        <EmptyState icon={<SearchX className="h-7 w-7" />} title="No courses match" description="Try a different keyword or category." />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
