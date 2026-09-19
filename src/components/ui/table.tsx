import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Server-safe table primitives. Only `TableWrap` (card mode + data-label hydration) is a client
 * component and lives in ./table-wrap so server pages can keep passing functions (`hrefFor`) to Pagination.
 */
export { TableWrap } from "@/components/ui/table-wrap";

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-surface text-xs font-semibold tracking-wide text-muted uppercase">{children}</thead>;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("px-4 py-3 font-semibold whitespace-nowrap", className)} {...props} />;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-surface/60", className)} {...props} />;
}

export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Card-mode label (defaults to the column header text; `""` shows the value without a label). */
  label?: string;
  /** Card-mode role: `full` = title row, `actions` = right-aligned footer, `hidden` = dropped on phones. */
  mobile?: "full" | "actions" | "hidden";
  /** Alias of `mobile="full"` (emits `data-primary`). */
  primary?: boolean;
  /** Alias of `mobile="actions"` (emits `data-actions`). */
  actions?: boolean;
}

export function TD({ className, label, mobile, primary, actions, ...props }: TDProps) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-ink", className)}
      data-label={label}
      data-mobile={mobile}
      data-primary={primary || undefined}
      data-actions={actions || undefined}
      {...props}
    />
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted">
        {children ?? "No records found."}
      </td>
    </tr>
  );
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  /** Builds the href for a page (server usage) */
  hrefFor?: (page: number) => string;
  /** Or a click handler (client usage) */
  onPageChange?: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, limit, hrefFor, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1 && !total) return null;
  const from = total && limit ? (page - 1) * limit + 1 : undefined;
  const to = total && limit ? Math.min(page * limit, total) : undefined;
  const pages = pageWindow(page, totalPages);
  const common = { current: page, hrefFor, onPageChange };

  return (
    <nav className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)} aria-label="Pagination">
      <p className="text-xs text-muted">
        {from !== undefined && to !== undefined ? `Showing ${from}–${to} of ${total}` : `Page ${page} of ${totalPages}`}
      </p>
      <div className="flex items-center gap-1">
        <PageButton {...common} p={page - 1} disabled={page <= 1} label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </PageButton>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <PageButton key={p} {...common} p={p}>
              {p}
            </PageButton>
          )
        )}
        <PageButton {...common} p={page + 1} disabled={page >= totalPages} label="Next page">
          <ChevronRight className="h-4 w-4" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  p,
  current,
  hrefFor,
  onPageChange,
  children,
  disabled,
  label,
}: {
  p: number;
  current: number;
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
}) {
  // 36px on desktop; 44px on phones (< sm) and on coarse pointers.
  const cls = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors tap-highlight-none max-sm:h-11 max-sm:min-w-11 pointer-coarse:h-11 pointer-coarse:min-w-11",
    p === current ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:bg-surface",
    disabled && "pointer-events-none opacity-40"
  );
  if (hrefFor) {
    // Server-safe: links for enabled pages, an inert span for disabled ones (no event handlers).
    if (disabled) {
      return (
        <span className={cls} aria-disabled="true" aria-label={label}>
          {children}
        </span>
      );
    }
    return (
      <Link href={hrefFor(p)} className={cls} aria-label={label} aria-current={p === current ? "page" : undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} disabled={disabled} onClick={() => onPageChange?.(p)} aria-label={label} aria-current={p === current ? "page" : undefined}>
      {children}
    </button>
  );
}

function pageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/** Mobile-friendly key/value list used when tables collapse into cards. */
export function DataList({ items, className }: { items: { label: React.ReactNode; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-0.5 border-b border-line/70 pb-2 last:border-0">
          <dt className="text-xs font-medium tracking-wide text-muted uppercase">{it.label}</dt>
          <dd className="text-sm font-medium text-ink">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
