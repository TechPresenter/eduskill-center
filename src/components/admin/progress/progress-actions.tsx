"use client";

import * as React from "react";
import { CheckCircle2, Flag, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { ReasonDialog } from "@/components/admin/pickers/reason-dialog";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

const NO_PERM = "You do not have permission to update progress";

/** Per-admission progress actions (list rows and the progress detail page). */
export function ProgressRowActions({ admissionId, studentName, status, allowed, compact }: { admissionId: string; studentName: string; status: string; allowed: boolean; compact?: boolean }) {
  const [complete, setComplete] = React.useState(false);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const size = compact ? "xs" : "sm";
  const open = status === "ACTIVE" || status === "ON_HOLD";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== "DROPPED" && (
        <Gate allowed={allowed} reason={NO_PERM}>
          <Button size={size} variant="outline" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} loading={busy && !complete} onClick={() => void run(() => api.post(`/api/admin/progress/${admissionId}/recompute`), { success: "Progress recomputed" })}>
            Recompute
          </Button>
        </Gate>
      )}
      {open && (
        <Gate allowed={allowed} reason={NO_PERM}>
          <Button size={size} variant="navy" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setComplete(true)}>
            Mark completed
          </Button>
        </Gate>
      )}
      <ReasonDialog
        open={complete}
        onClose={() => {
          clearErrors();
          setComplete(false);
        }}
        title="Mark training completed"
        description={`${studentName}'s training is marked complete, the application moves to Completed and certificate eligibility is recomputed.`}
        label="Note (optional)"
        minLength={0}
        confirmLabel="Mark completed"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await run(() => api.post<{ certificateEligible: boolean }>(`/api/admin/progress/${admissionId}/complete`, { note: note || undefined }), {
            success: "Training marked completed",
            successDescription: (d) => (d.certificateEligible ? "The student is now eligible for a certificate." : "Not yet eligible for a certificate – check attendance and assessments."),
          });
          if (r !== undefined) setComplete(false);
        }}
      />
    </div>
  );
}

/** Batch-level actions shown when the list is filtered to one batch. */
export function BatchProgressActions({ batchId, batchCode, batchStatus, activeCount, allowed }: { batchId: string; batchCode: string; batchStatus: string; activeCount: number; allowed: boolean }) {
  const [confirm, setConfirm] = React.useState(false);
  const { busy, run } = useMutation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Gate allowed={allowed} reason={NO_PERM}>
        <Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={busy && !confirm} onClick={() => void run(() => api.post<{ recomputed: number }>(`/api/admin/progress/batch/${batchId}/recompute`), { success: (d) => `Recomputed progress for ${d.recomputed} student${d.recomputed === 1 ? "" : "s"}` })}>
          Recompute batch
        </Button>
      </Gate>
      <Gate allowed={allowed && batchStatus !== "COMPLETED" && batchStatus !== "CANCELLED"} reason={batchStatus === "COMPLETED" ? "Batch is already completed" : batchStatus === "CANCELLED" ? "Batch is cancelled" : NO_PERM}>
        <Button size="sm" variant="navy" leftIcon={<Flag className="h-4 w-4" />} onClick={() => setConfirm(true)}>
          Complete batch
        </Button>
      </Gate>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Complete batch ${batchCode}`}
        description={`The batch is marked Completed, all ${activeCount} active admission${activeCount === 1 ? "" : "s"} become Completed, trainer assignments end and certificate eligibility is recomputed for everyone. This cannot be undone.`}
        confirmLabel="Complete batch"
        danger
        loading={busy}
        onConfirm={async () => {
          const r = await run(() => api.post<{ completed: number }>(`/api/admin/progress/batch/${batchId}/complete`), { success: (d) => `Batch completed – ${d.completed} admission${d.completed === 1 ? "" : "s"} marked complete` });
          if (r !== undefined) setConfirm(false);
        }}
      />
    </div>
  );
}
