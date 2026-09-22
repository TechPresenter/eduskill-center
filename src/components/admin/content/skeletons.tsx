import * as React from "react";
import { Skeleton, SkeletonTable } from "@/components/ui/feedback";
import { AppListSkeleton } from "@/components/admin/content/app-list";

/*
 * Route skeletons for the content / communication / administration screens. Each mirrors the real
 * page's blocks in the same order and at roughly the same heights (title, tabs, filter bar, list), so
 * nothing jumps when the content streams in: phones get the app-list shape, md+ the table shape.
 * Pulses honour prefers-reduced-motion through `Skeleton`.
 */

function Header() {
  return (
    <div className="hidden space-y-2 lg:block">
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

function Tabs() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

function Filters() {
  return <Skeleton className="h-11 w-full rounded-md lg:h-[4.5rem] lg:rounded-card" />;
}

function Stats({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-hidden sm:grid sm:grid-cols-3 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card w-[9.5rem] shrink-0 space-y-2 px-3 py-3 sm:w-auto sm:px-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export interface ListSkeletonProps {
  label: string;
  tabs?: boolean;
  filters?: boolean;
  stats?: boolean;
  rows?: number;
  cols?: number;
  /** "list": app list on phones + table from md. "rows": app list at every width. "grid": image / card grid. */
  variant?: "list" | "rows" | "grid";
}

export function ListSkeleton({ label, tabs, filters = true, stats, rows = 8, cols = 5, variant = "list" }: ListSkeletonProps) {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label={`Loading ${label}`}>
      <Header />
      {stats && <Stats />}
      {tabs && <Tabs />}
      {filters && <Filters />}
      {variant === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : variant === "rows" ? (
        <AppListSkeleton rows={rows} />
      ) : (
        <>
          <AppListSkeleton rows={Math.min(rows, 6)} className="md:hidden" />
          <div className="hidden md:block">
            <SkeletonTable rows={rows} cols={cols} cards={false} />
          </div>
        </>
      )}
    </div>
  );
}

/** Editor pages (blog post, event, page, section, template): the form card and its sticky bar. */
export function EditorSkeleton({ label, aside = true }: { label: string; aside?: boolean }) {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label={`Loading ${label}`}>
      <Header />
      <div className={aside ? "grid gap-4 xl:grid-cols-3 xl:gap-6" : undefined}>
        <div className="card card-p space-y-5 xl:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className={i === 4 ? "h-40 w-full rounded-md" : "h-11 w-full rounded-md"} />
            </div>
          ))}
        </div>
        {aside && (
          <div className="card hidden space-y-3 p-4 xl:block">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Detail pages (staff member, role, ticket): identity card, stat tiles, two columns of cards. */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="animate-fade-in space-y-4 motion-reduce:animate-none" aria-busy="true" aria-label={`Loading ${label}`}>
      <Header />
      <div className="card flex items-center gap-4 p-4 lg:hidden">
        <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <div className="card card-p space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="card card-p space-y-3 xl:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
