"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

export interface RunOptions<T> {
  /** Toast title on success (string or derived from the result). */
  success?: string | ((data: T) => string);
  /** Optional success description. */
  successDescription?: string | ((data: T) => string | undefined);
  /** Toast title on failure (the API message becomes the description). */
  error?: string;
  /** Refresh the current route after success (default true). */
  refresh?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
}

/**
 * Small helper for admin row/detail actions: runs an API call, surfaces toasts and 422 field errors,
 * and refreshes the server-rendered page so tables and badges update.
 */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const run = React.useCallback(
    async <T,>(fn: () => Promise<T>, opts: RunOptions<T> = {}): Promise<T | undefined> => {
      setBusy(true);
      setFieldErrors({});
      try {
        const data = await fn();
        if (opts.success) {
          const title = typeof opts.success === "function" ? opts.success(data) : opts.success;
          const desc = typeof opts.successDescription === "function" ? opts.successDescription(data) : opts.successDescription;
          toast.success(title, desc);
        }
        opts.onSuccess?.(data);
        if (opts.refresh !== false) router.refresh();
        return data;
      } catch (err) {
        if (err instanceof ApiClientError) {
          setFieldErrors(err.fieldErrors);
          toast.error(opts.error ?? "Action failed", err.message);
        } else {
          toast.error(opts.error ?? "Action failed", errorMessage(err));
        }
        opts.onError?.(err);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const clearErrors = React.useCallback(() => setFieldErrors({}), []);

  return { busy, fieldErrors, setFieldErrors, clearErrors, run };
}
