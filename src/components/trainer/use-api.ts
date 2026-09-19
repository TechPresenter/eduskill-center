"use client";

import * as React from "react";
import { api, errorMessage } from "@/lib/api-client";

interface Snapshot<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * GET helper for trainer-portal client components.
 * `loading` is derived from "requested key !== last settled key", so nothing is written to state synchronously
 * inside the effect (no cascading renders, and it satisfies the React Compiler lint rules).
 * Pass `null` as the url to skip fetching. `onLoad` runs once per successful response (latest closure, via useEffectEvent).
 */
export function useApi<T>(url: string | null, onLoad?: (data: T) => void) {
  const [seq, setSeq] = React.useState(0);
  const [snap, setSnap] = React.useState<Snapshot<T>>({ key: "", data: null, error: null });
  const key = url ? `${seq}:${url}` : "";
  const handleLoad = React.useEffectEvent((data: T) => onLoad?.(data));

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api
      .get<T>(url)
      .then((data) => {
        if (cancelled) return;
        setSnap({ key, data, error: null });
        handleLoad(data);
      })
      .catch((err) => {
        if (!cancelled) setSnap({ key, data: null, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const settled = !!url && snap.key === key;
  const reload = React.useCallback(() => setSeq((s) => s + 1), []);
  const setData = React.useCallback((updater: (current: T) => T) => setSnap((s) => (s.data === null ? s : { ...s, data: updater(s.data) })), []);
  return { data: settled ? snap.data : null, error: settled ? snap.error : null, loading: !!url && !settled, reload, setData };
}
