"use client";

import { Pagination } from "@/components/ui/table";
import { pageHref } from "@/components/admin/shared/url";

export interface PagerProps {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  /** Path of the list page; `params` are the current (flattened) search params. */
  base: string;
  params: Record<string, string>;
  className?: string;
}

/**
 * THE admin pager. Server pages hand it serialisable props instead of an `hrefFor` function, because
 * `src/components/ui/table.tsx` must stay a server module and functions cannot cross into a client one.
 *
 * Page 1 is written as no `page` key (see `pageHref`), so a list's first page has one canonical URL.
 * The audit found two byte-equivalent copies of this component that disagreed on exactly that point;
 * this is the one implementation.
 */
export function Pager({ page, totalPages, total, limit, base, params, className }: PagerProps) {
  return <Pagination className={className} page={page} totalPages={totalPages} total={total} limit={limit} hrefFor={pageHref(base, params)} />;
}
