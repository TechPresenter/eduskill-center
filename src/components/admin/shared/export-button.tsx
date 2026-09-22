"use client";

import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";

export type ExportFormat = "csv" | "xlsx" | "pdf";

const LABELS: Record<ExportFormat, { label: string; Icon: typeof FileText }> = {
  csv: { label: "CSV", Icon: Table2 },
  xlsx: { label: "Excel (XLSX)", Icon: FileSpreadsheet },
  pdf: { label: "PDF", Icon: FileText },
};

/**
 * What the endpoint can actually produce.
 *
 * Every admin export route under `/api/admin` streams CSV and nothing else; only the report
 * runner (`/api/admin/reports/[type]`) accepts `?format=json|csv|xlsx|pdf`. The old shared button
 * offered all three everywhere, so most screens advertised downloads the server would never send —
 * which is why one call site had to pass `formats={["csv"]}` by hand. Deriving the default from the
 * href keeps every existing call site correct without touching it. Pass `formats` to override.
 */
function formatsFor(href: string): ExportFormat[] {
  return href.includes("/api/admin/reports/") ? ["csv", "xlsx", "pdf"] : ["csv"];
}

export interface ExportButtonProps {
  /** The export endpoint. It may already carry a query string (the current filters). */
  href: string;
  /** Extra query params to append — typically `filtersOnly(sp)`. */
  params?: Record<string, string | undefined>;
  /** Formats to offer. Defaults to what the endpoint supports (see `formatsFor`). */
  formats?: ExportFormat[];
  /** Defaults to "Export CSV" when CSV is the only format on offer, otherwise "Export". */
  label?: string;
  /** No permission: renders an inert control that says so, rather than a link that 403s. */
  disabled?: boolean;
  className?: string;
}

/**
 * THE admin export control, replacing the two that had drifted apart (a bare CSV anchor and a
 * three-format dropdown). One behaviour now:
 *
 *   · one format  → a single `<a download>` styled as an outline button (no one-item menu)
 *   · several     → the same button opening a format menu, which is a bottom sheet below `sm`
 *   · disabled    → an inert, focusable-free span that names the missing permission
 *
 * A real `<a download>` (never `next/link`) so the browser streams the file instead of navigating,
 * and `withBasePath` because Next does not prefix a raw href under the deployment sub-path.
 */
export function ExportButton({ href, params = {}, formats, label, disabled, className }: ExportButtonProps) {
  const offered = formats ?? formatsFor(href);
  const single = offered.length <= 1;
  const only = offered[0] ?? "csv";
  // Name the format while there is only one — "Export CSV" tells the user what lands in Downloads.
  const text = label ?? (single ? `Export ${LABELS[only].label}` : "Export");

  const build = (fmt: ExportFormat) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    // Only ask for a format when there is a choice: the CSV-only routes parse their list schema and
    // have no `format` key, so sending one would be noise in the request and in the audit trail.
    if (!single) sp.set("format", fmt);
    const qs = sp.toString();
    if (!qs) return withBasePath(href);
    return `${withBasePath(href)}${href.includes("?") ? "&" : "?"}${qs}`;
  };

  if (disabled) {
    return (
      <span
        title="You do not have the export permission"
        aria-disabled="true"
        className={cn(buttonClasses({ variant: "outline", size: "sm" }), "pointer-coarse:h-11 cursor-not-allowed opacity-50", className)}
      >
        <Download className="h-4 w-4" aria-hidden /> {text}
      </span>
    );
  }

  if (single) {
    return (
      <a href={build(only)} download className={cn(buttonClasses({ variant: "outline", size: "sm" }), "pointer-coarse:h-11", className)}>
        <Download className="h-4 w-4" aria-hidden /> {text}
      </a>
    );
  }

  return (
    <Dropdown
      mobile="sheet"
      mobileTitle={text}
      mobileLabel={text}
      trigger={
        <button type="button" className={cn(buttonClasses({ variant: "outline", size: "sm" }), "pointer-coarse:h-11", className)}>
          <Download className="h-4 w-4" aria-hidden /> {text}
        </button>
      }
    >
      {offered.map((f) => {
        const { label: l, Icon } = LABELS[f];
        return (
          <a key={f} href={build(f)} download role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-sm text-ink transition-colors duration-micro hover:bg-surface motion-reduce:transition-none lg:min-h-0">
            <Icon className="h-4 w-4 text-muted" aria-hidden /> {l}
          </a>
        );
      })}
    </Dropdown>
  );
}
