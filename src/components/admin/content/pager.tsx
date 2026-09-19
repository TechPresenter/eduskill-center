"use client";

import { Pagination } from "@/components/ui/table";
import { withParams } from "@/components/admin/pickers/search-params";

/**
 * Client wrapper around the shared Pagination so server pages can paginate without passing
 * functions across the server/client boundary. Builds `base?…&page=n` from the current params.
 */
export function Pager({ page, totalPages, total, limit, base, params, className }: { page: number; totalPages: number; total: number; limit: number; base: string; params: Record<string, string>; className?: string }) {
  return <Pagination className={className} page={page} totalPages={totalPages} total={total} limit={limit} hrefFor={(p) => withParams(base, params, { page: p > 1 ? p : undefined })} />;
}
