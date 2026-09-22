"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { ImportReport, ImportRowResult } from "@/server/locations";

const TONE: Record<ImportRowResult["stateAction"] | "none", "success" | "neutral" | "danger" | "warning"> = { created: "success", exists: "neutral", error: "danger", skipped: "warning", none: "neutral" };

async function postImport(file: File, commit: boolean): Promise<ImportReport> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("commit", commit ? "true" : "false");
  const res = await fetch(withBasePath("/api/admin/locations/import"), { method: "POST", body: fd, credentials: "same-origin" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? `Import failed (${res.status})`);
  return json.data as ImportReport;
}

/** CSV import with a dry-run preview followed by an explicit commit. */
export function LocationImportDialog({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setReport(null);
    setError(null);
  };

  const run = async (commit: boolean) => {
    if (!file) return;
    setBusy(commit ? "commit" : "preview");
    setError(null);
    try {
      const r = await postImport(file, commit);
      setReport(r);
      if (commit) {
        toast.success("Import complete", `${r.created.states} states, ${r.created.districts} districts, ${r.created.blocks} blocks created.`);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const problemRows = report?.rows.filter((r) => r.error) ?? [];
  const canCommit = !!report && !report.commit && (report.created.states + report.created.districts + report.created.blocks > 0);

  return (
    <>
      <Button type="button" variant="outline" size="sm" leftIcon={<Upload className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled}>
        Import CSV
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
          reset();
        }}
        title="Import locations from CSV"
        description="Columns: state_name, state_code, district_name, district_code (optional), block_name (optional). Existing records are matched by name; nothing is written until you confirm."
        size="xl"
      >
        <div className="space-y-4">
          <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line bg-surface/60 px-4 py-6 text-center hover:border-navy/40", busy && "pointer-events-none opacity-60")}>
            <FileUp className="h-6 w-6 text-navy" />
            <span className="text-body-sm font-semibold break-all text-ink">{file ? file.name : "Choose a .csv file"}</span>
            <span className="text-caption text-muted">Up to 10 MB · 5,000 rows</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setReport(null);
                setError(null);
              }}
            />
          </label>

          {error && <Alert tone="danger">{error}</Alert>}

          {report && (
            <div className="space-y-3">
              <Alert tone={report.commit ? "success" : report.errors ? "warning" : "info"} title={report.commit ? "Import written to the database" : "Preview – nothing has been saved yet"}>
                {report.totalRows} row{report.totalRows === 1 ? "" : "s"} · {report.created.states} new state{report.created.states === 1 ? "" : "s"}, {report.created.districts} new district{report.created.districts === 1 ? "" : "s"}, {report.created.blocks} new block{report.created.blocks === 1 ? "" : "s"} · {report.existing.districts} district{report.existing.districts === 1 ? "" : "s"} already existed · {report.errors} row error{report.errors === 1 ? "" : "s"}
              </Alert>
              {/* Phones: one card per row (the preview table needs 640px). */}
              <ul className="scrollbar-thin max-h-72 space-y-2 overflow-y-auto md:hidden">
                {(problemRows.length ? problemRows : report.rows.slice(0, 200)).map((r) => (
                  <li key={r.row} className={cn("rounded-md border border-line p-3", r.error ? "border-danger/40 bg-danger-light/40" : "bg-white")}>
                    <p className="flex items-center justify-between gap-2 text-caption font-semibold text-muted">
                      <span>Row {r.row}</span>
                      {r.error && <Badge tone="danger">error</Badge>}
                    </p>
                    <dl className="mt-1.5 space-y-1 text-body-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <dt className="text-caption font-semibold tracking-wide text-muted uppercase">State</dt>
                        <dd className="flex flex-wrap items-center gap-1.5 text-ink">
                          {r.state || "—"} <Badge tone={TONE[r.stateAction]}>{r.stateAction}</Badge>
                        </dd>
                      </div>
                      {r.district && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <dt className="text-caption font-semibold tracking-wide text-muted uppercase">District</dt>
                          <dd className="flex flex-wrap items-center gap-1.5 text-ink">
                            {r.district} <Badge tone={TONE[r.districtAction]}>{r.districtAction}</Badge>
                          </dd>
                        </div>
                      )}
                      {r.block && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <dt className="text-caption font-semibold tracking-wide text-muted uppercase">Block</dt>
                          <dd className="flex flex-wrap items-center gap-1.5 text-ink">
                            {r.block} <Badge tone={TONE[r.blockAction]}>{r.blockAction}</Badge>
                          </dd>
                        </div>
                      )}
                    </dl>
                    {r.error && <p className="mt-1.5 text-caption font-medium text-danger">{r.error}</p>}
                  </li>
                ))}
              </ul>
              <div className="scrollbar-thin hidden max-h-72 overflow-auto rounded-md border border-line md:block">
                <table className="w-full min-w-[640px] text-left text-caption">
                  <thead className="sticky top-0 bg-surface text-caption font-semibold tracking-wide text-muted uppercase">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">State</th>
                      <th className="px-3 py-2">District</th>
                      <th className="px-3 py-2">Block</th>
                      <th className="px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(problemRows.length ? problemRows : report.rows.slice(0, 200)).map((r) => (
                      <tr key={r.row} className={cn(r.error && "bg-danger-light/40")}>
                        <td className="px-3 py-1.5 text-muted tabular-nums">{r.row}</td>
                        <td className="px-3 py-1.5">
                          <span className="mr-1.5">{r.state || "—"}</span>
                          <Badge tone={TONE[r.stateAction]}>{r.stateAction}</Badge>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="mr-1.5">{r.district || "—"}</span>
                          {r.district && <Badge tone={TONE[r.districtAction]}>{r.districtAction}</Badge>}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="mr-1.5">{r.block || "—"}</span>
                          {r.block && <Badge tone={TONE[r.blockAction]}>{r.blockAction}</Badge>}
                        </td>
                        <td className="px-3 py-1.5 text-danger">{r.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {problemRows.length > 0 && <p className="text-caption text-muted">Showing only rows with problems ({problemRows.length}). Rows with errors are skipped; the rest can still be imported.</p>}
              {problemRows.length === 0 && report.rows.length > 200 && <p className="text-caption text-muted">Showing the first 200 of {report.rows.length} rows.</p>}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={!!busy}
            >
              {report?.commit ? "Close" : "Cancel"}
            </Button>
            {!report?.commit && (
              <>
                <Button type="button" variant="navy" onClick={() => run(false)} loading={busy === "preview"} disabled={!file || !!busy}>
                  Preview
                </Button>
                <Button type="button" onClick={() => run(true)} loading={busy === "commit"} disabled={!canCommit || !!busy}>
                  Import {report ? `${report.created.states + report.created.districts + report.created.blocks} records` : ""}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
