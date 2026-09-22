"use client";

import * as React from "react";
import Link from "next/link";
import { Award, CheckSquare, Square } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/responsive-table";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { KeyValue } from "@/components/ui/misc";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

export interface Candidate {
  admissionId: string;
  admissionNo: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  courseName: string;
  centerName: string;
  batchCode: string;
  completedAt: string | Date | null;
  attendancePct: number;
  assessmentAvgPct: number;
  finalMarksPct: number | null;
  autoGrade: string | null;
}

interface IssueResult {
  issued: number;
  failed: number;
  results: { admissionId: string; ok: boolean; certificateNo?: string; error?: string }[];
}

const marksOf = (c: Candidate) => (c.finalMarksPct !== null ? `${c.finalMarksPct}%` : c.assessmentAvgPct > 0 ? `${c.assessmentAvgPct}%` : "—");

/**
 * Eligible admissions with per-row issue (optional grade override) and bulk issue of the selected rows.
 *
 * Rows carry selection checkboxes, so the list uses `ResponsiveTable`: the familiar table from `md` up and
 * tap-to-select cards below it, with the bulk action in a sticky bottom bar instead of a top-right button.
 */
export function EligibleTable({ items, canIssue }: { items: Candidate[]; canIssue: boolean }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [single, setSingle] = React.useState<Candidate | null>(null);
  const [grade, setGrade] = React.useState("");
  const [bulk, setBulk] = React.useState(false);
  const [failures, setFailures] = React.useState<{ name: string; error: string }[]>([]);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.admissionId));
  const nameOf = (id: string) => items.find((i) => i.admissionId === id)?.studentName ?? id;

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.admissionId)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const openIssue = (c: Candidate) => {
    setGrade("");
    setSingle(c);
  };

  const issueButton = (c: Candidate, full?: boolean) => (
    <Gate allowed={canIssue} reason="You do not have permission to issue certificates">
      <Button size={full ? "sm" : "xs"} variant="secondary" fullWidth={full} leftIcon={<Award className="h-3.5 w-3.5" />} onClick={() => openIssue(c)}>
        Issue
      </Button>
    </Gate>
  );

  const columns: ResponsiveColumn<Candidate>[] = [
    {
      key: "select",
      label: "Select",
      header: <input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-orange" checked={allSelected} onChange={toggleAll} disabled={items.length === 0} />,
      cell: (c) => <input type="checkbox" aria-label={`Select ${c.studentName}`} className="h-4 w-4 accent-orange" checked={selected.has(c.admissionId)} onChange={() => toggle(c.admissionId)} />,
      className: "w-8",
      hideOnMobile: true,
    },
    {
      key: "student",
      header: "Student",
      primary: true,
      cell: (c) => (
        <>
          <Link href={`/admin/admissions/${c.admissionId}`} className="font-semibold hover:text-navy">
            {c.studentName}
          </Link>
          <span className="block font-mono text-caption font-normal text-muted">{c.studentCode ?? c.admissionNo}</span>
        </>
      ),
    },
    { key: "course", header: "Course", cell: (c) => c.courseName },
    {
      key: "center",
      header: "Center & batch",
      cell: (c) => (
        <>
          <span className="block">{c.centerName}</span>
          <span className="font-mono text-caption text-muted">{c.batchCode}</span>
        </>
      ),
    },
    { key: "attendance", header: "Attendance", align: "center", className: "tabular-nums", cell: (c) => `${c.attendancePct}%` },
    { key: "assessment", header: "Assessment", align: "center", className: "tabular-nums", cell: marksOf },
    { key: "completed", header: "Completed", className: "whitespace-nowrap text-muted", cell: (c) => (c.completedAt ? formatDate(c.completedAt) : "—") },
    { key: "grade", header: "Grade", cell: (c) => c.autoGrade ?? <span className="text-caption text-muted">None</span> },
  ];

  /** Phone card: the whole header row toggles selection, the footer issues a single certificate. */
  const renderCard = (c: Candidate) => {
    const on = selected.has(c.admissionId);
    return (
      <article className={cn("card p-4 transition-colors duration-micro motion-reduce:transition-none", on && "border-orange bg-orange-light/30")}>
        <button
          type="button"
          onClick={() => toggle(c.admissionId)}
          aria-pressed={on}
          className="-m-4 mb-0 flex w-[calc(100%+2rem)] items-start gap-3 rounded-t-card p-4 text-left tap-highlight-none active:bg-surface/70"
        >
          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center", on ? "text-orange" : "text-muted")} aria-hidden>
            {on ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-h4 font-semibold text-navy">{c.studentName}</span>
            <span className="block font-mono text-caption text-muted">{c.studentCode ?? c.admissionNo}</span>
            <span className="mt-0.5 block text-body-sm text-muted">
              {c.courseName} · {c.batchCode}
            </span>
          </span>
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line/70 pt-3">
          <KeyValue label="Attendance" value={`${c.attendancePct}%`} />
          <KeyValue label="Assessment" value={marksOf(c)} />
          <KeyValue label="Completed" value={c.completedAt ? formatDate(c.completedAt) : "—"} />
          <KeyValue label="Grade" value={c.autoGrade ?? "None"} />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-line/70 pt-3">
          <ButtonLink href={`/admin/admissions/${c.admissionId}`} variant="outline" size="sm" className="flex-1">
            Admission
          </ButtonLink>
          <span className="flex-1 *:w-full">{issueButton(c, true)}</span>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm text-muted">{selected.size ? `${selected.size} selected` : `${items.length} eligible admission${items.length === 1 ? "" : "s"} on this page`}</p>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button type="button" onClick={toggleAll} className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-body-sm font-semibold text-navy md:hidden">
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? "Clear all" : "Select all"}
            </button>
          )}
          <span className="hidden md:inline-flex">
            <Gate allowed={canIssue && selected.size > 0} reason={selected.size === 0 ? "Select at least one student" : "You do not have permission to issue certificates"}>
              <Button size="sm" leftIcon={<Award className="h-4 w-4" />} onClick={() => setBulk(true)}>
                Issue {selected.size > 0 ? `${selected.size} selected` : "selected"}
              </Button>
            </Gate>
          </span>
        </div>
      </div>
      {failures.length > 0 && (
        <Alert tone="warning" title={`${failures.length} certificate${failures.length === 1 ? "" : "s"} could not be issued`}>
          <ul className="list-disc pl-4">
            {failures.map((f, i) => (
              <li key={i}>
                <strong>{f.name}</strong>: {f.error}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(c) => c.admissionId}
        actions={(c) => issueButton(c)}
        renderCard={renderCard}
        caption="Admissions eligible for a certificate"
        emptyState="No eligible admissions match these filters. Students become eligible once training is complete and attendance / assessment thresholds are met."
      />

      {/* Bulk issue lives in a sticky bar on phones so the selection stays reachable while scrolling. */}
      {selected.size > 0 && (
        <StickyActionBar desktop="hidden" innerClassName="gap-2">
          <Button variant="outline" size="md" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <span className="flex-1 *:w-full">
            <Gate allowed={canIssue} reason="You do not have permission to issue certificates">
              <Button size="md" fullWidth leftIcon={<Award className="h-4 w-4" />} onClick={() => setBulk(true)}>
                Issue {selected.size} certificate{selected.size === 1 ? "" : "s"}
              </Button>
            </Gate>
          </span>
        </StickyActionBar>
      )}

      <Modal
        open={!!single}
        onClose={() => {
          clearErrors();
          setSingle(null);
        }}
        title="Issue certificate"
        description={single ? `${single.studentName} · ${single.courseName} · ${single.batchCode}` : undefined}
        size="sm"
      >
        {single && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await run(() => api.post<IssueResult>("/api/admin/certificates/issue", { admissionId: single.admissionId, grade: grade.trim() || undefined }), {
                success: (d) => `Certificate ${d.results[0]?.certificateNo ?? ""} issued`,
                successDescription: "The PDF is stored and the student has been notified.",
              });
              if (r !== undefined) {
                setSingle(null);
                setSelected((s) => {
                  const n = new Set(s);
                  n.delete(single.admissionId);
                  return n;
                });
              }
            }}
            noValidate
          >
            <Field label="Grade (optional override)" htmlFor="cert-grade" hint={single.autoGrade ? `Leave blank to use the computed grade “${single.autoGrade}”.` : "No assessment marks – leave blank for no grade, or enter one (e.g. A, B, Pass)."} error={fieldErrors.grade}>
              <Input id="cert-grade" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={10} placeholder={single.autoGrade ?? "e.g. A"} />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setSingle(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} leftIcon={<Award className="h-4 w-4" />}>
                Issue certificate
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={bulk}
        onClose={() => setBulk(false)}
        title={`Issue ${selected.size} certificate${selected.size === 1 ? "" : "s"}`}
        description="Grades are computed automatically from assessment marks. Each certificate is generated, stored and the student notified; any that fail are listed afterwards."
        confirmLabel="Issue certificates"
        loading={busy}
        onConfirm={async () => {
          const ids = [...selected];
          const r = await run(() => api.post<IssueResult>("/api/admin/certificates/issue", { admissionIds: ids }), {
            success: (d) => `${d.issued} certificate${d.issued === 1 ? "" : "s"} issued${d.failed ? `, ${d.failed} failed` : ""}`,
          });
          if (r) {
            setFailures(r.results.filter((x) => !x.ok).map((x) => ({ name: nameOf(x.admissionId), error: x.error ?? "Unknown error" })));
            setSelected(new Set(r.results.filter((x) => !x.ok).map((x) => x.admissionId)));
            setBulk(false);
          }
        }}
      />
    </div>
  );
}
