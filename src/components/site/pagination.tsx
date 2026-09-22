import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEM = "inline-flex h-11 min-w-11 sm:h-10 sm:min-w-10 items-center justify-center rounded-md border px-2.5 text-body-sm font-medium transition-colors duration-micro motion-reduce:transition-none";
const ITEM_IDLE = cn(ITEM, "border-line bg-white text-ink hover:bg-surface");
const ITEM_ACTIVE = cn(ITEM, "border-navy bg-navy text-white");
const ITEM_DISABLED = cn(ITEM, "border-line bg-white text-ink opacity-40");

/** Page numbers to show: first, last, and a window around the current page, with ellipses. */
function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

function ArrowLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className={ITEM_DISABLED} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={ITEM_IDLE} aria-label={label}>
      {children}
    </Link>
  );
}

/**
 * Link-only pagination for server-rendered public listings. Every page is a real URL
 * (crawlable, works without JavaScript); it never passes handlers, so it is safe to render
 * from server components.
 */
export function SitePagination({ page, totalPages, total, limit, hrefFor, className }: { page: number; totalPages: number; total?: number; limit?: number; hrefFor: (page: number) => string; className?: string }) {
  if (totalPages <= 1) return null;
  const from = total !== undefined && limit ? (page - 1) * limit + 1 : undefined;
  const to = total !== undefined && limit ? Math.min(page * limit, total) : undefined;

  return (
    <nav className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)} aria-label="Pagination">
      <p className="text-caption text-muted">{from !== undefined && to !== undefined ? `Showing ${from}–${to} of ${total}` : `Page ${page} of ${totalPages}`}</p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <ArrowLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </ArrowLink>
        </li>
        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <li key={`e${i}`} className="px-1 text-muted" aria-hidden>
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span className={ITEM_ACTIVE} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link href={hrefFor(p)} className={ITEM_IDLE} aria-label={`Page ${p}`}>
                  {p}
                </Link>
              )}
            </li>
          )
        )}
        <li>
          <ArrowLink href={hrefFor(page + 1)} disabled={page >= totalPages} label="Next page">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </ArrowLink>
        </li>
      </ul>
    </nav>
  );
}
