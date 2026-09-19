"use client";

import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { buttonClasses } from "@/components/ui/button";

export type ExportFormat = "csv" | "xlsx" | "pdf";

const LABELS: Record<ExportFormat, { label: string; Icon: typeof FileText }> = {
  csv: { label: "CSV", Icon: Table2 },
  xlsx: { label: "Excel (XLSX)", Icon: FileSpreadsheet },
  pdf: { label: "PDF", Icon: FileText },
};

/**
 * Dropdown of download links. `href` is the export endpoint; `format=<fmt>` is appended
 * along with the current filters (`params`). The trigger is 44px on phones and coarse pointers, and
 * the format list opens as a bottom sheet below `sm`.
 */
export function ExportButton({ href, params = {}, formats = ["csv", "xlsx", "pdf"], label = "Export", disabled }: { href: string; params?: Record<string, string | undefined>; formats?: ExportFormat[]; label?: string; disabled?: boolean }) {
  const build = (fmt: ExportFormat) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("format", fmt);
    return `${href}?${sp.toString()}`;
  };
  return (
    <Dropdown
      mobile="sheet"
      mobileTitle={label}
      mobileLabel={label}
      trigger={
        <button type="button" disabled={disabled} className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-coarse:h-11" })}>
          <Download className="h-4 w-4" aria-hidden /> {label}
        </button>
      }
    >
      {formats.map((f) => {
        const { label: l, Icon } = LABELS[f];
        return (
          // A real <a download> (not next/link) so the browser streams the file instead of navigating.
          <a key={f} href={build(f)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface lg:min-h-0" role="menuitem" download>
            <Icon className="h-4 w-4 text-muted" aria-hidden /> {l}
          </a>
        );
      })}
    </Dropdown>
  );
}
