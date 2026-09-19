"use client";

import { Pagination } from "@/components/ui/table";
import { withParams } from "@/components/admin/pickers/search-params";

interface PagerProps {
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
 * Server-page friendly pagination: builds `?page=` links from serialisable props so the page
 * never has to hand a function (or a disabled `<button onClick>`) across the server/client boundary.
 */
export function Pager({ page, totalPages, total, limit, base, params, className }: PagerProps) {
  return <Pagination className={className} page={page} totalPages={totalPages} total={total} limit={limit} hrefFor={(p) => withParams(base, params, { page: p })} />;
}
