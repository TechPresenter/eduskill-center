"use client";

import * as React from "react";
import { api } from "@/lib/api-client";
import type { SearchGroups } from "@/server/search";

export const SEARCH_DEBOUNCE_MS = 180;
const MIN_LENGTH = 2;
const CACHE_SIZE = 30;

export type SearchStatus = "idle" | "loading" | "success" | "error";

export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Debounced, cancellable search against /api/public/search.
 *
 * All state is derived from two pieces — a small query→result cache and the last failed query — so
 * backspacing to an earlier query is instant, stale responses can never overwrite a newer query, and
 * no state is set synchronously inside the effect. While a new query loads, `data` keeps the most
 * recent result (flagged `stale`) so the list does not flash a skeleton on every keystroke.
 */
export function useSiteSearch(raw: string, { enabled = true, limit }: { enabled?: boolean; limit?: number } = {}) {
  const query = normalizeQuery(raw);
  const key = query.toLowerCase();
  const active = enabled && query.length >= MIN_LENGTH;
  const [cache, setCache] = React.useState<Map<string, SearchGroups>>(() => new Map());
  const [last, setLast] = React.useState<SearchGroups | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  const hit = active ? cache.get(key) : undefined;
  const isError = active && !hit && failed === key;

  React.useEffect(() => {
    if (!active || hit || failed === key) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (limit) params.set("limit", String(limit));
      api
        .get<SearchGroups>(`/api/public/search?${params.toString()}`, { signal: ctrl.signal })
        .then((data) => {
          setCache((prev) => {
            const next = new Map(prev);
            next.set(key, data);
            while (next.size > CACHE_SIZE) next.delete(next.keys().next().value as string);
            return next;
          });
          setLast(data);
          setFailed((f) => (f === key ? null : f));
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
          setFailed(key);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [active, hit, failed, key, query, limit]);

  // Clearing the failure re-runs the effect above, which requests the query again.
  const retry = () => setFailed(null);

  const status: SearchStatus = !active ? "idle" : hit ? "success" : isError ? "error" : "loading";
  const data = hit ?? (status === "loading" ? last : null);
  return { query, status, data, stale: status === "loading" && data !== null, retry };
}
