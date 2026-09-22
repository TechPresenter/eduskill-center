"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorSummaryItem {
  /** Id of the invalid control; the link jumps to it and focuses it. */
  id: string;
  message: React.ReactNode;
}

export interface ErrorSummaryProps {
  /** Invalid fields, in form order. With none, nothing renders unless `message` is set. */
  errors: ErrorSummaryItem[];
  /** A form-level message (e.g. the API's error text) shown under the heading. */
  message?: React.ReactNode;
  title?: React.ReactNode;
  /**
   * Bump this number on every failed submit. The summary takes focus each time it changes, so a
   * screen-reader and keyboard user lands on the list of what to fix. Blur validation never bumps
   * it, so focus is never moved while someone is tabbing through the form.
   */
  focusSignal?: number;
  className?: string;
}

/**
 * The focusable error summary a failed submit shows at the top of a form (`role="alert"`,
 * `tabIndex={-1}`, a heading, one link per invalid field). It COMPLEMENTS the inline error `Field`
 * renders under each control; it never replaces it.
 */
export function ErrorSummary({ errors, message, title = "Please fix the following", focusSignal = 0, className }: ErrorSummaryProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const headingId = React.useId();

  React.useEffect(() => {
    if (focusSignal > 0) ref.current?.focus();
  }, [focusSignal]);

  if (errors.length === 0 && !message) return null;

  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  };

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn("ring-focus rounded-md border border-danger/30 bg-danger-light p-4 text-danger outline-none", className)}
    >
      <p id={headingId} className="flex items-center gap-2 text-body-sm font-bold">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        {title}
      </p>
      {message && <p className="mt-1.5 text-body-sm text-ink">{message}</p>}
      {errors.length > 0 && (
        <ul className="mt-2 space-y-1 pl-6">
          {errors.map((e) => (
            <li key={e.id} className="list-disc text-body-sm">
              <a href={`#${e.id}`} onClick={jump(e.id)} className="ring-focus inline-flex min-h-11 items-center rounded-xs font-semibold underline underline-offset-2 sm:min-h-0">
                {e.message}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
