import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, DataList } from "@/components/ui/table";
import { EmptyContent } from "@/components/ui/feedback";

/*
 * Server-component safe (no "use client"): columns/cells are evaluated wherever ResponsiveTable renders, so
 * server pages can pass `cell`, `rowHref` and `actions` functions freely. Interactive cells (checkboxes,
 * inline inputs, dropdowns) must come from client components supplied by the caller.
 */

export interface ResponsiveColumn<T> {
  /** Stable column id. */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Card title on phones (also the `data-mobile="full"` cell when TableWrap card mode is used). */
  primary?: boolean;
  /** Card subtitle on phones (rendered under the title). */
  secondary?: boolean;
  /** Rendered top-right of the card (e.g. `<StatusBadge>`). */
  status?: boolean;
  /** Skip this column in the phone card. */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
  /** Extra classes for the `<th>`/`<td>` (desktop). */
  className?: string;
  /** Plain-text label for the card when `header` is not a string. */
  label?: string;
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Makes the card header (and a trailing chevron cell on desktop) a link to the row's detail page. */
  rowHref?: (row: T) => string | undefined;
  /** Row actions (buttons/menus) rendered in the last table cell and in the card footer. */
  actions?: (row: T) => React.ReactNode;
  /** Replace the default card entirely on phones. */
  renderCard?: (row: T) => React.ReactNode;
  /** Shown when `rows` is empty (both layouts). */
  emptyState?: React.ReactNode;
  /** Where the table takes over from the cards. Default `md` (matches TableWrap card mode). */
  breakpoint?: "md" | "lg";
  className?: string;
  /** Extra classes for each default phone card. */
  cardClassName?: string;
  /** Screen-reader caption for the table (defaults to nothing). */
  caption?: string;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;
const SHOW_FROM = { md: { table: "hidden md:block", cards: "md:hidden" }, lg: { table: "hidden lg:block", cards: "lg:hidden" } } as const;

function headerLabel<T>(c: ResponsiveColumn<T>) {
  return c.label ?? (typeof c.header === "string" || typeof c.header === "number" ? String(c.header) : c.key);
}

/**
 * Table on desktop, stacked cards on phones, from one column definition. Use it for lists whose cells hold
 * selection checkboxes, inline inputs or menus (where the CSS-only TableWrap card mode falls short); plain
 * read-only tables can keep `<TableWrap>` + `<TD label>`.
 */
export function ResponsiveTable<T>({ columns, rows, rowKey, rowHref, actions, renderCard, emptyState, breakpoint = "md", className, cardClassName, caption }: ResponsiveTableProps<T>) {
  const bp = SHOW_FROM[breakpoint];
  const trailing = Boolean(actions || rowHref);
  const colSpan = columns.length + (trailing ? 1 : 0);

  return (
    <div className={className}>
      {/* ── Desktop table ── */}
      <div className={bp.table}>
        <TableWrap cards={false}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <THead>
            <tr>
              {columns.map((c) => (
                <TH key={c.key} className={cn(c.align && ALIGN[c.align], c.className)}>
                  {c.header}
                </TH>
              ))}
              {trailing && (
                <TH className="w-px text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              )}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={colSpan}>{emptyState}</EmptyRow>
            ) : (
              rows.map((row) => {
                const href = rowHref?.(row);
                return (
                  <TR key={rowKey(row)}>
                    {columns.map((c) => (
                      <TD
                        key={c.key}
                        label={headerLabel(c)}
                        mobile={c.primary ? "full" : c.hideOnMobile ? "hidden" : undefined}
                        className={cn(c.align && ALIGN[c.align], c.primary && "font-medium text-navy", c.className)}
                      >
                        {c.cell(row)}
                      </TD>
                    ))}
                    {trailing && (
                      <TD mobile="actions" className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center justify-end gap-1">
                          {actions?.(row)}
                          {href && (
                            <Link
                              href={href}
                              className="duration-micro ring-focus inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-navy motion-reduce:transition-none"
                              aria-label="Open"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}
                        </span>
                      </TD>
                    )}
                  </TR>
                );
              })
            )}
          </TBody>
        </TableWrap>
      </div>

      {/* ── Phone cards ── */}
      <CardList
        rows={rows}
        rowKey={rowKey}
        hideFrom={breakpoint}
        empty={emptyState}
        render={(row) => (renderCard ? renderCard(row) : <DefaultCard row={row} columns={columns} href={rowHref?.(row)} actions={actions?.(row)} className={cardClassName} />)}
      />
    </div>
  );
}

/*
 * THE phone card. There are two ways a row becomes a card in this codebase — the CSS-only
 * `.table-cards` mode in globals.css (TableWrap) and this component — and the audit found them
 * rendering the same row as two different-looking cards. They now share ONE visual contract:
 *
 *   shape      rounded-card · 1px border-line · bg-white · p-4 · shadow-e1 · 0.75rem apart
 *   title      text-h4 text-navy, full width, separated by a border-b border-line/70 pb-3
 *   details    DataList variant="rows" — 12px uppercase label in a 38% left column, value right
 *   actions    right-aligned footer above a border-t border-line/70 pt-3
 *
 * If you change one, change the other (`@utility table-cards`) in the same commit.
 */
function DefaultCard<T>({ row, columns, href, actions, className }: { row: T; columns: ResponsiveColumn<T>[]; href?: string; actions?: React.ReactNode; className?: string }) {
  const primary = columns.find((c) => c.primary);
  const secondary = columns.find((c) => c.secondary);
  const status = columns.find((c) => c.status);
  const rest = columns.filter((c) => c !== primary && c !== secondary && c !== status && !c.hideOnMobile);

  const header = (
    <>
      <div className="min-w-0 flex-1">
        {primary ? <p className="text-h4 text-navy">{primary.cell(row)}</p> : null}
        {secondary ? <p className="text-body-sm mt-0.5 text-muted">{secondary.cell(row)}</p> : null}
      </div>
      {status && <div className="shrink-0">{status.cell(row)}</div>}
      {href && <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />}
    </>
  );
  const hasHeader = Boolean(primary || secondary || status);
  // The title is separated from the detail rows exactly the way `.table-cards` separates them.
  const headerCls = cn("flex items-start gap-3", (rest.length > 0 || actions) && "border-b border-line/70 pb-3");

  return (
    <article className={cn("rounded-card border border-line bg-white p-4 shadow-e1", className)}>
      {hasHeader &&
        (href ? (
          <Link href={href} className={cn("duration-micro ring-focus tap-highlight-none -m-4 mb-0 rounded-t-card p-4 transition-colors active:bg-surface/70 motion-reduce:transition-none", headerCls)}>
            {header}
          </Link>
        ) : (
          <div className={headerCls}>{header}</div>
        ))}
      {rest.length > 0 && <DataList variant="rows" className={cn(hasHeader && "mt-2")} items={rest.map((c) => ({ label: headerLabel(c), value: c.cell(row) }))} />}
      {actions && <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-line/70 pt-3">{actions}</div>}
    </article>
  );
}

export interface CardListProps<T> {
  rows: T[];
  rowKey: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  /** Shown when `rows` is empty. */
  empty?: React.ReactNode;
  /** Hide the list from this breakpoint up (the table takes over). `false` keeps it at every width. */
  hideFrom?: "md" | "lg" | false;
  className?: string;
}

/** Stacked card list for phones; pair with a `hidden md:block` table or use standalone. */
export function CardList<T>({ rows, rowKey, render, empty, hideFrom = "md", className }: CardListProps<T>) {
  const hide = hideFrom === "md" ? "md:hidden" : hideFrom === "lg" ? "lg:hidden" : undefined;
  if (rows.length === 0) {
    // One empty state for the whole product: a plain string becomes the shared EmptyState, a node is
    // rendered as given. No second dashed-div implementation lives here any more.
    return (
      <div className={cn(hide, className)}>
        <EmptyContent content={empty} size="sm" />
      </div>
    );
  }
  return (
    <ul className={cn("space-y-3", hide, className)}>
      {rows.map((row) => (
        <li key={rowKey(row)}>{render(row)}</li>
      ))}
    </ul>
  );
}
