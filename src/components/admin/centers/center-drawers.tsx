"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Field } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatDate, titleCase } from "@/lib/utils";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { BatchForm, type BatchFormOptions } from "@/components/admin/batches/batch-form";

/** "Create batch" drawer with the center pre-selected. */
export function CreateBatchDrawer({ centerId, options, disabled }: { centerId: string; options: BatchFormOptions; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled}>
        Create batch
      </Button>
      <ResponsiveSheet open={open} onClose={() => setOpen(false)} title="Create a batch" description="The batch code is generated from this center's code." className="max-w-xl" height="full">
        <BatchForm
          options={options}
          lockCenterId={centerId}
          compact
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </ResponsiveSheet>
    </>
  );
}

export interface TrainerChoice {
  id: string;
  trainerId: string;
  name: string;
  level: string;
  location: string;
  centerIds: string[];
}

export interface BatchChoice {
  id: string;
  code: string;
  name: string;
  status: string;
  courseId: string;
  courseName: string;
  startDate: string;
  trainerName: string | null;
}

/** Assigns an active trainer to this center, optionally for a course or batch. */
export function AssignTrainerDrawer({ centerId, trainers, courses, batches, disabled }: { centerId: string; trainers: TrainerChoice[]; courses: { id: string; name: string; code: string }[]; batches: BatchChoice[]; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [trainerId, setTrainerId] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const visibleBatches = courseId ? batches.filter((b) => b.courseId === courseId) : batches;
  const trainerOptions = [
    ...trainers.filter((t) => t.centerIds.includes(centerId)).map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId}) · ${titleCase(t.level)} · already at this center` })),
    ...trainers.filter((t) => !t.centerIds.includes(centerId)).map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId}) · ${titleCase(t.level)} · ${t.location}` })),
  ];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.post(`/api/admin/centers/${centerId}/trainers`, { trainerId, courseId: courseId || null, batchId: batchId || null, notes: notes || null }), { silent: true });
    if (res !== undefined) {
      toast.success("Trainer assigned", "The trainer has been notified.");
      setOpen(false);
      setTrainerId("");
      setCourseId("");
      setBatchId("");
      setNotes("");
      router.refresh();
    }
  };

  return (
    <>
      <Button size="sm" variant="navy" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled}>
        Assign trainer
      </Button>
      <ResponsiveSheet open={open} onClose={() => !loading && setOpen(false)} title="Assign a trainer" description="Only active trainers can be assigned. Course and batch are optional.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
          <Field label="Trainer" htmlFor="at-trainer" required error={fieldErrors.trainerId} hint={trainers.length === 0 ? "No active trainers exist yet. Approve trainer applications first." : undefined}>
            <Select id="at-trainer" value={trainerId} onChange={(e) => { setTrainerId(e.target.value); clearField("trainerId"); }} options={trainerOptions} placeholder="Select a trainer" required invalid={!!fieldErrors.trainerId} />
          </Field>
          <Field label="Course (optional)" htmlFor="at-course" error={fieldErrors.courseId}>
            <Select id="at-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchId(""); }} options={courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="Any course" invalid={!!fieldErrors.courseId} />
          </Field>
          <Field label="Batch (optional)" htmlFor="at-batch" error={fieldErrors.batchId} hint={batchId ? "The trainer becomes the batch trainer; current students are linked to them." : visibleBatches.length === 0 ? "No upcoming or ongoing batches match." : undefined}>
            <Select id="at-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={visibleBatches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name} · ${b.courseName} · ${titleCase(b.status)} · from ${formatDate(b.startDate)}${b.trainerName ? ` · currently ${b.trainerName}` : ""}` }))} placeholder="No specific batch" invalid={!!fieldErrors.batchId} />
          </Field>
          <Field label="Notes (optional)" htmlFor="at-notes" error={fieldErrors.notes}>
            <Textarea id="at-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!trainerId} className="sm:w-auto">
              Assign
            </Button>
          </div>
        </form>
      </ResponsiveSheet>
    </>
  );
}

export function EndAssignmentButton({ centerId, assignmentId, trainerName }: { centerId: string; assignmentId: string; trainerName: string }) {
  return (
    <ConfirmAction method="delete" url={`/api/admin/centers/${centerId}/trainers/${assignmentId}`} title={`End ${trainerName}'s assignment?`} description="The assignment is closed. If it was for a batch, that batch no longer has a trainer." confirmLabel="End assignment" danger successMessage="Assignment ended" icon={<UserMinus className="h-3.5 w-3.5" />}>
      End
    </ConfirmAction>
  );
}
