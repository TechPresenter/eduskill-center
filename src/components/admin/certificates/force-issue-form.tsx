"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate, isUuid, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { useMutation } from "@/components/admin/pickers/use-mutation";
import { withBasePath } from "@/lib/base-path";

interface AdmissionPreview {
  id: string;
  admissionNo: string;
  status: string;
  completedAt: string | null;
  student: { id: string; name: string; studentId: string | null };
  course: { name: string; minAttendancePct: number; passingMarksPct: number };
  center: { name: string; code: string };
  batch: { code: string; name: string; status: string; endDate: string };
  progress: { attendancePct: number; assessmentAvgPct: number; certificateEligible: boolean; isCompleted: boolean } | null;
  certificate: { id: string; certificateNo: string; status: string } | null;
}

/** Force-issue a certificate for an admission that is not (yet) eligible – requires explicit confirmation. */
export function ForceIssueForm({ initialAdmissionId, canIssue }: { initialAdmissionId?: string; canIssue: boolean }) {
  const [admissionId, setAdmissionId] = React.useState(initialAdmissionId ?? "");
  // The id currently being looked up (plus a nonce so the same id can be re-fetched after issuing).
  const [lookupId, setLookupId] = React.useState<{ id: string; nonce: number }>({ id: initialAdmissionId && isUuid(initialAdmissionId) ? initialAdmissionId : "", nonce: 0 });
  const [result, setResult] = React.useState<{ key: string; preview: AdmissionPreview | null; error: string | null }>({ key: "", preview: null, error: null });
  const [formatError, setFormatError] = React.useState<string | null>(null);
  const [grade, setGrade] = React.useState("");
  const [completionDate, setCompletionDate] = React.useState("");
  const [ackKey, setAckKey] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [issued, setIssued] = React.useState<{ key: string; certificateId: string; certificateNo: string } | null>(null);
  const { busy, fieldErrors, run } = useMutation();
  const key = lookupId.id ? `${lookupId.id}#${lookupId.nonce}` : "";

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    api
      .get<AdmissionPreview>(`/api/admin/admissions/${lookupId.id}`)
      .then((d) => !cancelled && setResult({ key, preview: d, error: null }))
      .catch((err) => !cancelled && setResult({ key, preview: null, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [key, lookupId.id]);

  const current = result.key === key ? result : null;
  const preview = key ? (current?.preview ?? null) : null;
  const lookupError = formatError ?? (key ? (current?.error ?? null) : null);
  const looking = !!key && !current;
  const ack = ackKey === key;
  const issuedHere = issued && issued.key === key ? issued : null;
  const lookup = (id: string) => {
    if (!isUuid(id)) {
      setFormatError("Enter a valid admission ID (UUID) – copy it from the admission page URL.");
      return;
    }
    setFormatError(null);
    setLookupId((l) => ({ id, nonce: l.nonce + 1 }));
  };

  const eligible = !!preview?.progress?.certificateEligible;

  return (
    <div className="max-w-3xl space-y-5">
      <Alert tone="warning" title="Bypasses eligibility checks">
        Use only when the Foundation has verified completion outside the system (e.g. attendance kept on paper). The action is audited as a forced issue.
      </Alert>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(admissionId.trim());
        }}
      >
        <Field label="Admission ID" htmlFor="force-admission" className="flex-1" error={lookupError ?? undefined} hint="The UUID from /admin/admissions/<id>.">
          <Input id="force-admission" value={admissionId} onChange={(e) => setAdmissionId(e.target.value)} placeholder="e.g. 01a0b421-45d1-7199-a618-68c22f92988e" invalid={!!lookupError} className="font-mono" />
        </Field>
        <Button type="submit" variant="outline" leftIcon={<Search className="h-4 w-4" />} loading={looking} className="sm:mb-[22px]">
          Look up
        </Button>
      </form>

      {preview && (
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-navy">
                <Link href={`/admin/students/${preview.student.id}`} className="hover:underline">
                  {preview.student.name}
                </Link>{" "}
                <span className="font-mono text-sm text-muted">{preview.student.studentId ?? ""}</span>
              </p>
              <p className="text-sm text-muted">
                {preview.course.name} · {preview.center.name} ({preview.center.code}) · batch {preview.batch.code}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Link href={`/admin/admissions/${preview.id}`} className="font-mono text-navy hover:underline">
                  {preview.admissionNo}
                </Link>
                <StatusBadge status={preview.status} />
                <span className="text-muted">batch</span>
                <StatusBadge status={preview.batch.status} />
              </p>
            </div>
            {preview.certificate ? (
              <Badge tone={preview.certificate.status === "ISSUED" ? "success" : "danger"}>Certificate {preview.certificate.certificateNo} already {preview.certificate.status.toLowerCase()}</Badge>
            ) : eligible ? (
              <Badge tone="success">Already eligible – normal issue applies</Badge>
            ) : (
              <Badge tone="warning">Not eligible</Badge>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-medium text-muted uppercase">Attendance</dt>
              <dd className={`font-semibold tabular-nums ${(preview.progress?.attendancePct ?? 0) >= preview.course.minAttendancePct ? "text-green-700" : "text-danger"}`}>
                {preview.progress?.attendancePct ?? 0}% <span className="text-xs font-normal text-muted">/ {preview.course.minAttendancePct}%</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-muted uppercase">Assessment</dt>
              <dd className="font-semibold tabular-nums">{preview.progress?.assessmentAvgPct ? `${preview.progress.assessmentAvgPct}%` : "—"} <span className="text-xs font-normal text-muted">/ {preview.course.passingMarksPct}%</span></dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-muted uppercase">Training</dt>
              <dd className="font-semibold">{preview.progress?.isCompleted || preview.status === "COMPLETED" ? "Completed" : titleCase(preview.status)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-muted uppercase">Batch ends</dt>
              <dd className="font-semibold">{formatDate(preview.batch.endDate)}</dd>
            </div>
          </dl>

          {issuedHere ? (
            <Alert tone="success" title={`Certificate ${issuedHere.certificateNo} issued`}>
              <a href={withBasePath(`/api/admin/certificates/${issuedHere.certificateId}/download`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Download PDF
              </a>{" "}
              ·{" "}
              <Link href={`/verify-certificate/${issuedHere.certificateNo}`} target="_blank" className="font-semibold underline">
                Verification page
              </Link>
            </Alert>
          ) : preview.certificate ? null : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (ack) setConfirm(true);
              }}
              noValidate
            >
              <FormGrid>
                <Field label="Grade (optional)" htmlFor="force-grade" error={fieldErrors.grade} hint="Leave blank to compute from assessment marks (or none).">
                  <Input id="force-grade" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={10} placeholder="e.g. A" />
                </Field>
                <Field label="Completion date (optional)" htmlFor="force-date" error={fieldErrors.completionDate} hint="Defaults to the admission's completion date or the batch end date.">
                  <Input id="force-date" type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
                </Field>
              </FormGrid>
              <Checkbox checked={ack} onChange={(e) => setAckKey(e.target.checked ? key : "")} label="I confirm this student has completed the training and the Foundation approves issuing the certificate despite the eligibility rules." />
              <div className="flex justify-end">
                <Button type="submit" variant="danger" leftIcon={<Award className="h-4 w-4" />} disabled={!ack || !canIssue} title={canIssue ? undefined : "You do not have permission to issue certificates"}>
                  Force issue certificate
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Force issue certificate"
        description={preview ? `Issue a certificate to ${preview.student.name} for ${preview.course.name} without the eligibility check? This is recorded in the audit log.` : undefined}
        confirmLabel="Yes, issue it"
        danger
        loading={busy}
        onConfirm={async () => {
          if (!preview) return;
          const r = await run(() => api.post<{ results: { certificateId?: string; certificateNo?: string }[] }>("/api/admin/certificates/issue", { admissionId: preview.id, force: true, grade: grade.trim() || undefined, completionDate: completionDate || undefined }), {
            success: (d) => `Certificate ${d.results[0]?.certificateNo ?? ""} issued`,
          });
          if (r) {
            const first = r.results[0];
            if (first?.certificateId && first.certificateNo) setIssued({ key, certificateId: first.certificateId, certificateNo: first.certificateNo });
            setConfirm(false);
          }
        }}
      />
    </div>
  );
}
