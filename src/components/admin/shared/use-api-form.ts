"use client";

import * as React from "react";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

/**
 * Small state machine for admin forms that submit to the JSON API:
 * tracks loading, a top-level error and 422 field errors.
 */
export function useApiForm() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const submit = React.useCallback(async <T,>(fn: () => Promise<T>, opts: { errorTitle?: string; silent?: boolean } = {}): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFieldErrors(err.fieldErrors);
        setError(err.message);
        if (!opts.silent && err.status !== 422) toast.error(opts.errorTitle ?? "Request failed", err.message);
      } else {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        if (!opts.silent) toast.error(opts.errorTitle ?? "Request failed", msg);
      }
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearField = React.useCallback((name: string) => {
    setFieldErrors((f) => {
      if (!f[name]) return f;
      const next = { ...f };
      delete next[name];
      return next;
    });
  }, []);

  return { loading, error, fieldErrors, submit, setError, setFieldErrors, clearField };
}
