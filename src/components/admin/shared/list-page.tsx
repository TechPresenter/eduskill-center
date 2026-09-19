import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, type PageHeaderProps } from "@/components/ui/misc";
import { Fab } from "@/components/ui/fab";

export interface AdminListPageProps {
  /** Passed straight to `PageHeader` (set `mobileTitle` when the title is long or holds markup). */
  header: PageHeaderProps;
  /** The `<FilterBar>` (or any toolbar) rendered above the list. */
  filters?: React.ReactNode;
  /** Tabs / status strip rendered between the header and the filters. */
  tabs?: React.ReactNode;
  /** The list itself: cards on phones, table at `md`+ (`TableWrap` / `ResponsiveTable`). */
  children: React.ReactNode;
  /** `<Pagination hrefFor={…}>`; kept server-safe by rendering it here rather than passing functions down. */
  pagination?: React.ReactNode;
  /**
   * "Add …" floating action button for phones (hidden from `lg` up, where the header action is visible).
   * Only render it when the user actually has the create permission.
   */
  fab?: { href: string; label: string; icon?: React.ReactNode; extended?: boolean };
  className?: string;
}

/**
 * Shared frame for every admin list page: app-bar title via `PageHeader`, the collapsing `FilterBar`,
 * the list and its pager, plus an optional mobile FAB for the primary "Add …" action.
 *
 * Server-component safe – it only composes elements the caller already rendered.
 */
export function AdminListPage({ header, filters, tabs, children, pagination, fab, className }: AdminListPageProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <PageHeader {...header} />
      {tabs}
      {filters}
      {children}
      {pagination}
      {fab && (
        <Fab
          aria-label={fab.label}
          label={fab.extended ? fab.label : undefined}
          extended={fab.extended ?? false}
          href={fab.href}
          icon={fab.icon ?? <Plus className="h-6 w-6" aria-hidden />}
        />
      )}
    </div>
  );
}
