import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyContent } from "@/components/ui/feedback";

/*
 * Server-safe table primitives. Only `TableWrap` (card mode + data-label hydration) is a client
 * component and lives in ./table-wrap so server pages can keep passing functions (`hrefFor`) to Pagination.
 */
export { TableWrap } from "@/components/ui/table-wrap";

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="text-caption bg-surface font-semibold tracking-wide text-muted uppercase">{children}</thead>;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("px-4 py-3 font-semibold whitespace-nowrap", className)} {...props} />;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("duration-micro transition-colors hover:bg-surface/60 motion-reduce:transition-none", className)} {...props} />;
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

/**
 * The "nothing here" row. A plain string (or nothing) renders the shared `EmptyState` in its compact,
 * frameless step — the same mark, title and rhythm a phone card list and a standalone panel use.
 * A caller-supplied node (e.g. a full `<EmptyState>` with an action) is rendered untouched.
 */
export function EmptyRow({ colSpan, children }: { colSpan: number; children?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4">
        <EmptyContent content={children} size="sm" bare />
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
      <p className="text-caption text-muted">
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
    "text-body-sm duration-micro ring-focus tap-highlight-none inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 font-semibold transition-colors motion-reduce:transition-none max-sm:h-11 max-sm:min-w-11 pointer-coarse:h-11 pointer-coarse:min-w-11",
    p === current ? "border-navy bg-navy text-white shadow-e1" : "border-line bg-white text-ink hover:border-navy/30 hover:bg-surface",
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

export interface DataListItem {
  label: React.ReactNode;
  value: React.ReactNode;
}

/**
 * Semantic key/value list (`<dl>`), used wherever a table row becomes a card.
 *
 * `variant="rows"` is THE phone-card detail layout: label left in a 38% column, value right —
 * byte-for-byte the contract `.table-cards` applies in CSS (globals.css), so a row rendered by
 * TableWrap's card mode and the same row rendered by ResponsiveTable's card look identical.
 * `variant="grid"` is the roomier two-column form used inside detail panels.
 */
export function DataList({ items, className, variant = "grid" }: { items: DataListItem[]; className?: string; variant?: "grid" | "rows" }) {
  if (variant === "rows") {
    return (
      <dl className={cn("flex flex-col", className)}>
        {items.map((it, i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-1.5">
            <dt className="text-caption basis-[38%] shrink-0 pt-0.5 font-semibold tracking-wide text-muted uppercase">{it.label}</dt>
            <dd className="text-body-sm min-w-0 flex-1 text-right font-medium text-ink">{it.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-0.5 border-b border-line/70 pb-2 last:border-0">
          <dt className="text-caption font-semibold tracking-wide text-muted uppercase">{it.label}</dt>
          <dd className="text-body-sm font-medium text-ink">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
