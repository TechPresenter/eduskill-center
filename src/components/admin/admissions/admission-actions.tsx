"use client";

import * as React from "react";
import Link from "next/link";
import { Award, CalendarDays, CheckCircle2, PauseCircle, PlayCircle, RefreshCw, UserCog, UserX } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { BatchPicker } from "@/components/admin/pickers/batch-picker";
import { ReasonDialog } from "@/components/admin/pickers/reason-dialog";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

export interface TrainerOption {
  id: string;
  trainerId: string;
  name: string;
  level: string;
}

export interface AdmissionActionsProps {
  admissionId: string;
  admissionNo: string;
  studentName: string;
  status: string;
  currentBatchId: string;
  trainerId: string | null;
  trainers: TrainerOption[];
  certificateEligible: boolean;
  certificate: { id: string; certificateNo: string } | null;
  can: { update: boolean; progress: boolean; issue: boolean };
}

type DialogKind = "batch" | "trainer" | "hold" | "reactivate" | "drop" | "complete" | "issue" | null;
const NO_PERM = "You do not have permission for this action";

/** Header actions for an admission record. */
export function AdmissionActions(p: AdmissionActionsProps) {
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [batchId, setBatchId] = React.useState<string | null>(p.currentBatchId);
  const [batchNote, setBatchNote] = React.useState("");
  const [trainer, setTrainer] = React.useState(p.trainerId ?? "");
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const base = `/api/admin/admissions/${p.admissionId}`;
  const open = p.status === "ACTIVE" || p.status === "ON_HOLD";
  const close = () => {
    clearErrors();
    setDialog(null);
  };
  const canChange = p.can.update || p.can.progress;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {open && (
        <>
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<CalendarDays className="h-4 w-4" />}
              onClick={() => {
                setBatchId(p.currentBatchId);
                setBatchNote("");
                setDialog("batch");
              }}
            >
              Change batch
            </Button>
          </Gate>
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<UserCog className="h-4 w-4" />}
              onClick={() => {
                setTrainer(p.trainerId ?? "");
                setDialog("trainer");
              }}
            >
              Assign trainer
            </Button>
          </Gate>
          {p.status === "ACTIVE" ? (
            <Gate allowed={p.can.update} reason={NO_PERM}>
              <Button size="sm" variant="outline" leftIcon={<PauseCircle className="h-4 w-4" />} onClick={() => setDialog("hold")}>
                Put on hold
              </Button>
            </Gate>
          ) : (
            <Gate allowed={p.can.update} reason={NO_PERM}>
              <Button size="sm" variant="secondary" leftIcon={<PlayCircle className="h-4 w-4" />} onClick={() => setDialog("reactivate")}>
                Reactivate
              </Button>
            </Gate>
          )}
          <Gate allowed={canChange} reason={NO_PERM}>
            <Button size="sm" variant="navy" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setDialog("complete")}>
              Mark completed
            </Button>
          </Gate>
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<UserX className="h-4 w-4" />} onClick={() => setDialog("drop")}>
              Drop
            </Button>
          </Gate>
        </>
      )}
      {p.status !== "DROPPED" && (
        <Gate allowed={canChange} reason={NO_PERM}>
          <Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={busy && dialog === null} onClick={() => void run(() => api.post(`${base}/recompute`), { success: "Progress recomputed" })}>
            Recompute progress
          </Button>
        </Gate>
      )}
      {p.certificate ? (
        <Link href={`/admin/certificates?q=${encodeURIComponent(p.certificate.certificateNo)}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-success-light px-3.5 text-sm font-semibold text-green-700 hover:bg-success/20">
          <Award className="h-4 w-4" /> {p.certificate.certificateNo}
        </Link>
      ) : p.certificateEligible ? (
        <Gate allowed={p.can.issue} reason={NO_PERM}>
          <Button size="sm" leftIcon={<Award className="h-4 w-4" />} onClick={() => setDialog("issue")}>
            Issue certificate
          </Button>
        </Gate>
      ) : (
        <Link href={`/admin/certificates?tab=force&admissionId=${p.admissionId}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-sm font-semibold text-muted hover:bg-surface" title="Not eligible yet – open the Certificates module to force-issue">
          <Award className="h-4 w-4" /> Certificate (not eligible)
        </Link>
      )}

      {dialog === "batch" && (
        <Drawer open onClose={close} title="Change batch" description="Moves the student (and their seat) to another open batch of the same course at this center. Progress is recomputed." className="max-w-xl">
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!batchId) return;
              const r = await run(() => api.put(`${base}/batch`, { batchId, note: batchNote.trim() || undefined }), { success: "Student moved to the new batch" });
              if (r !== undefined) close();
            }}
            noValidate
          >
            <Field label="New batch" error={fieldErrors.batchId}>
              <BatchPicker endpoint={`${base}/batch`} value={batchId} onChange={(id) => setBatchId(id)} currentBatchId={p.currentBatchId} />
            </Field>
            <Field label="Note (optional)" htmlFor="adm-batch-note" error={fieldErrors.note}>
              <Textarea id="adm-batch-note" rows={2} value={batchNote} onChange={(e) => setBatchNote(e.target.value)} placeholder="Reason for the change – kept on the admission record." />
            </Field>
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!batchId || batchId === p.currentBatchId}>
                Move student
              </Button>
            </div>
          </form>
        </Drawer>
      )}

      <Modal open={dialog === "trainer"} onClose={close} title="Assign trainer" description="Overrides the batch trainer for this student only. Leave empty to follow the batch trainer." size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => api.put(`${base}/trainer`, { trainerId: trainer || null }), { success: trainer ? "Trainer assigned" : "Trainer removed" });
            if (r !== undefined) close();
          }}
          noValidate
        >
          <Field label="Trainer" htmlFor="adm-trainer" error={fieldErrors.trainerId}>
            <Select id="adm-trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} options={p.trainers.map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId}) · ${t.level.toLowerCase()} level` }))} placeholder="No trainer (use batch trainer)" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={trainer === (p.trainerId ?? "")}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ReasonDialog
        open={dialog === "hold"}
        onClose={close}
        title="Put admission on hold"
        description="The student keeps their seat while paused. Reactivate the admission when they return to training."
        label="Note"
        minLength={3}
        confirmLabel="Put on hold"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await run(() => api.post(`${base}/status`, { status: "ON_HOLD", note }), { success: "Admission put on hold" });
          if (r !== undefined) close();
        }}
      />
      <ReasonDialog
        open={dialog === "reactivate"}
        onClose={close}
        title="Reactivate admission"
        label="Note (optional)"
        minLength={0}
        confirmLabel="Reactivate"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await run(() => api.post(`${base}/status`, { status: "ACTIVE", note: note || undefined }), { success: "Admission reactivated" });
          if (r !== undefined) close();
        }}
      />
      <ReasonDialog
        open={dialog === "drop"}
        onClose={close}
        title="Drop student"
        description={`${p.studentName} leaves the batch, the seat is released and the application is cancelled. This cannot be undone.`}
        label="Reason"
        minLength={3}
        confirmLabel="Drop student"
        danger
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await run(() => api.post(`${base}/status`, { status: "DROPPED", note }), { success: "Student dropped" });
          if (r !== undefined) close();
        }}
      />
      <ReasonDialog
        open={dialog === "complete"}
        onClose={close}
        title="Mark training completed"
        description={`${p.studentName}'s training is marked complete (${p.admissionNo}), the application moves to Completed and certificate eligibility is recomputed.`}
        label="Note (optional)"
        minLength={0}
        confirmLabel="Mark completed"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await run(() => api.post<{ certificateEligible: boolean }>(`${base}/complete`, { note: note || undefined }), {
            success: "Training marked completed",
            successDescription: (d) => (d.certificateEligible ? "The student is now eligible for a certificate." : "The student is not yet eligible for a certificate (attendance or assessment below the course minimum)."),
          });
          if (r !== undefined) close();
        }}
      />
      <ConfirmDialog
        open={dialog === "issue"}
        onClose={close}
        title="Issue certificate"
        description={
          <span>
            A certificate is generated for <strong>{p.studentName}</strong> with an auto-computed grade, stored as a PDF and the student is notified. Use the Certificates module to override the grade.
          </span>
        }
        confirmLabel="Issue certificate"
        loading={busy}
        onConfirm={async () => {
          const r = await run(() => api.post<{ results: { certificateNo?: string }[] }>("/api/admin/certificates/issue", { admissionId: p.admissionId }), { success: (d) => `Certificate ${d.results[0]?.certificateNo ?? ""} issued` });
          if (r !== undefined) close();
        }}
      />
      {p.status === "ON_HOLD" && <Alert tone="warning" className="basis-full">This admission is on hold – reactivate it when the student resumes training.</Alert>}
    </div>
  );
}
