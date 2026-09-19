"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Pencil, PlayCircle, Trash2, UserCog, XCircle, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";

export interface BatchActionTarget {
  id: string;
  code: string;
  name: string;
  status: string;
  occupied: number;
  activeStudents: number;
  trainerId: string | null;
}

export interface BatchPerms {
  update: boolean;
  delete: boolean;
  assign: boolean;
}

export interface TrainerOption {
  id: string;
  trainerId: string;
  name: string;
  level: string;
  centerIds: string[];
}

const closed = (s: string) => s === "COMPLETED" || s === "CANCELLED";

function StatusItems({ batch, perms }: { batch: BatchActionTarget; perms: BatchPerms }) {
  if (!perms.update || batch.status === "COMPLETED") return null;
  const url = `/api/admin/batches/${batch.id}/status`;
  return (
    <>
      {batch.status === "UPCOMING" && (
        <ConfirmAction asMenuItem icon={<PlayCircle className="h-4 w-4" />} method="patch" url={url} body={{ status: "ONGOING" }} title={`Mark ${batch.code} as ongoing?`} description="Classes have started. Attendance can be marked for ongoing batches." confirmLabel="Mark ongoing" successMessage="Batch is now ongoing">
          Mark as ongoing
        </ConfirmAction>
      )}
      {batch.status === "ONGOING" && (
        <ConfirmAction asMenuItem icon={<RotateCcw className="h-4 w-4" />} method="patch" url={url} body={{ status: "UPCOMING" }} title={`Move ${batch.code} back to upcoming?`} description="Use this if the batch was marked ongoing by mistake." confirmLabel="Mark upcoming" successMessage="Batch is now upcoming">
          Mark as upcoming
        </ConfirmAction>
      )}
      {batch.status === "CANCELLED" && (
        <ConfirmAction asMenuItem icon={<RotateCcw className="h-4 w-4" />} method="patch" url={url} body={{ status: "UPCOMING" }} title={`Reopen ${batch.code}?`} description="The batch becomes upcoming again and can accept students." confirmLabel="Reopen" successMessage="Batch reopened">
          Reopen batch
        </ConfirmAction>
      )}
      {(batch.status === "UPCOMING" || batch.status === "ONGOING") && (
        <ConfirmAction asMenuItem icon={<CheckCircle2 className="h-4 w-4" />} method="post" url={`/api/admin/batches/${batch.id}/complete`} title={`Complete ${batch.code}?`} description={<span>All {batch.activeStudents} active admission{batch.activeStudents === 1 ? "" : "s"} will be marked <strong>completed</strong>, progress and certificate eligibility are recomputed and the trainer assignment ends. This cannot be undone.</span>} confirmLabel="Complete batch" successMessage="Batch completed">
          Complete batch
        </ConfirmAction>
      )}
      {(batch.status === "UPCOMING" || batch.status === "ONGOING") && (
        <ConfirmAction asMenuItem danger icon={<XCircle className="h-4 w-4" />} method="patch" url={url} body={{ status: "CANCELLED" }} title={`Cancel ${batch.code}?`} description="The batch stops accepting students. Existing admissions are not changed – move them to another batch first if needed." confirmLabel="Cancel batch" successMessage="Batch cancelled">
          Cancel batch
        </ConfirmAction>
      )}
    </>
  );
}

function DeleteItem({ batch, perms, redirectTo }: { batch: BatchActionTarget; perms: BatchPerms; redirectTo?: string }) {
  if (!perms.delete) return null;
  const blocked = batch.occupied > 0;
  return (
    <ConfirmAction asMenuItem danger icon={<Trash2 className="h-4 w-4" />} method="delete" url={`/api/admin/batches/${batch.id}`} title={`Delete ${batch.code}?`} description={blocked ? `${batch.occupied} seat(s) are occupied or reserved. Cancel the batch instead of deleting it.` : "The batch is removed from every list."} confirmLabel="Delete" successMessage="Batch deleted" disabled={blocked} redirectTo={redirectTo}>
      Delete
    </ConfirmAction>
  );
}

export function BatchRowActions({ batch, perms }: { batch: BatchActionTarget; perms: BatchPerms }) {
  return (
    <RecordActions
      label={`Actions for ${batch.code}`}
      items={[
        { label: "View", href: `/admin/batches/${batch.id}`, icon: <Eye className="h-4 w-4" /> },
        { label: "Edit", href: `/admin/batches/${batch.id}/edit`, icon: <Pencil className="h-4 w-4" />, hidden: !perms.update },
      ]}
    >
      <StatusItems batch={batch} perms={perms} />
      <DeleteItem batch={batch} perms={perms} />
    </RecordActions>
  );
}

/** Assign or change the trainer through PATCH /trainer (records an assignment and links students). */
export function AssignTrainerButton({ batch, trainers, centerId, disabled }: { batch: BatchActionTarget; trainers: TrainerOption[]; centerId: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [trainerId, setTrainerId] = React.useState(batch.trainerId ?? "");
  const [notes, setNotes] = React.useState("");
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const options = [
    ...trainers.filter((t) => t.centerIds.includes(centerId)).map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId}) · ${titleCase(t.level)} · at this center` })),
    ...trainers.filter((t) => !t.centerIds.includes(centerId)).map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId}) · ${titleCase(t.level)}` })),
  ];
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.patch(`/api/admin/batches/${batch.id}/trainer`, { trainerId, notes: notes || null }), { silent: true });
    if (res !== undefined) {
      toast.success("Trainer assigned", "Current students are now linked to this trainer.");
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <>
      <Button size="sm" variant="navy" leftIcon={<UserCog className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled || closed(batch.status)}>
        {batch.trainerId ? "Change trainer" : "Assign trainer"}
      </Button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title={batch.trainerId ? "Change the batch trainer" : "Assign a trainer"} description="The previous assignment for this batch is ended and active students are linked to the new trainer.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
          <Field label="Trainer" htmlFor="bt-trainer" required error={fieldErrors.trainerId} hint={trainers.length === 0 ? "No active trainers available." : undefined}>
            <Select id="bt-trainer" value={trainerId} onChange={(e) => { setTrainerId(e.target.value); clearField("trainerId"); }} options={options} placeholder="Select a trainer" required invalid={!!fieldErrors.trainerId} />
          </Field>
          <Field label="Notes (optional)" htmlFor="bt-notes" error={fieldErrors.notes}>
            <Textarea id="bt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!trainerId || trainerId === batch.trainerId}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function BatchHeaderActions({ batch, perms, trainers, centerId }: { batch: BatchActionTarget; perms: BatchPerms; trainers: TrainerOption[]; centerId: string }) {
  return (
    <>
      {perms.update && (
        <ButtonLink href={`/admin/batches/${batch.id}/edit`} variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
          Edit
        </ButtonLink>
      )}
      {(perms.update || perms.assign) && <AssignTrainerButton batch={batch} trainers={trainers} centerId={centerId} />}
      {perms.update && batch.status === "UPCOMING" && (
        <ConfirmAction size="sm" icon={<PlayCircle className="h-4 w-4" />} method="patch" url={`/api/admin/batches/${batch.id}/status`} body={{ status: "ONGOING" }} title={`Mark ${batch.code} as ongoing?`} description="Classes have started. Attendance can be marked for ongoing batches." confirmLabel="Mark ongoing" successMessage="Batch is now ongoing">
          Mark ongoing
        </ConfirmAction>
      )}
      {perms.update && batch.status === "ONGOING" && (
        <ConfirmAction size="sm" icon={<CheckCircle2 className="h-4 w-4" />} method="post" url={`/api/admin/batches/${batch.id}/complete`} title={`Complete ${batch.code}?`} description={<span>All {batch.activeStudents} active admission{batch.activeStudents === 1 ? "" : "s"} will be marked <strong>completed</strong>, progress and certificate eligibility are recomputed and the trainer assignment ends. This cannot be undone.</span>} confirmLabel="Complete batch" successMessage="Batch completed">
          Complete batch
        </ConfirmAction>
      )}
      {(perms.update || perms.delete) && (
        <RecordActions label="More actions">
          <StatusItems batch={batch} perms={perms} />
          <DeleteItem batch={batch} perms={perms} redirectTo="/admin/batches" />
        </RecordActions>
      )}
    </>
  );
}
