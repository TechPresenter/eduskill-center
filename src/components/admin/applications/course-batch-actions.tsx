"use client";

import * as React from "react";
import { ArrowLeftRight, CalendarDays } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { BatchPicker } from "@/components/admin/pickers/batch-picker";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

/** "Change batch" drawer for an application (before admission is confirmed). */
export function ChangeBatchButton({ applicationId, currentBatchId, allowed, reason }: { applicationId: string; currentBatchId: string | null; allowed: boolean; reason?: string }) {
  const [open, setOpen] = React.useState(false);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const [batchId, setBatchId] = React.useState<string | null>(currentBatchId);
  const close = () => {
    clearErrors();
    setOpen(false);
  };
  return (
    <>
      <Gate allowed={allowed} reason={reason ?? "Batch can no longer be changed here"}>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<CalendarDays className="h-4 w-4" />}
          onClick={() => {
            setBatchId(currentBatchId);
            setOpen(true);
          }}
        >
          {currentBatchId ? "Change batch" : "Assign batch"}
        </Button>
      </Gate>
      {open && (
        <Drawer open onClose={close} title={currentBatchId ? "Change batch" : "Assign batch"} description="Only open batches of this course at this center are listed, with live seat availability." className="max-w-xl">
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await run(() => api.put<{ batch: { code: string } | null }>(`/api/admin/applications/${applicationId}/batch`, { batchId }), {
                success: (d) => (d.batch ? `Batch ${d.batch.code} assigned` : "Batch cleared"),
              });
              if (r !== undefined) close();
            }}
            noValidate
          >
            <Field label="Batch" error={fieldErrors.batchId}>
              <BatchPicker endpoint={`/api/admin/applications/${applicationId}/batch`} value={batchId} onChange={(id) => setBatchId(id)} allowNone currentBatchId={currentBatchId} />
            </Field>
            <Alert tone="info">Once the application is approved, a seat is reserved and changing to a full batch is refused. The student is notified of the new batch.</Alert>
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={batchId === currentBatchId}>
                Save batch
              </Button>
            </div>
          </form>
        </Drawer>
      )}
    </>
  );
}

export interface CenterOption {
  id: string;
  name: string;
  code: string;
  status: string;
}
export interface CourseOption {
  id: string;
  name: string;
  code: string;
  status: string;
}

/** Change course and/or center before approval; fees are recalculated and the batch is cleared. */
export function ChangeCourseCenterButton({ applicationId, centerId, courseId, centers, courses, allowed, reason }: { applicationId: string; centerId: string; courseId: string; centers: CenterOption[]; courses: CourseOption[]; allowed: boolean; reason?: string }) {
  const [open, setOpen] = React.useState(false);
  const [c, setC] = React.useState(centerId);
  const [k, setK] = React.useState(courseId);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const close = () => {
    clearErrors();
    setLocalError(null);
    setOpen(false);
  };
  const changed = c !== centerId || k !== courseId;
  return (
    <>
      <Gate allowed={allowed} reason={reason ?? "Center or course can only be changed before approval"}>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<ArrowLeftRight className="h-4 w-4" />}
          onClick={() => {
            setC(centerId);
            setK(courseId);
            setOpen(true);
          }}
        >
          Change course / center
        </Button>
      </Gate>
      <Modal open={open} onClose={close} title="Change course or center" description="The course must be offered at the chosen center. Fees are recalculated from the course and any assigned batch is cleared.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!changed) {
              setLocalError("Choose a different center or course");
              return;
            }
            setLocalError(null);
            const body: Record<string, string> = {};
            if (c !== centerId) body.centerId = c;
            if (k !== courseId) body.courseId = k;
            const r = await run(() => api.post(`/api/admin/applications/${applicationId}/change-course`, body), { success: "Application updated", successDescription: "Fees were recalculated. Assign a batch before approving." });
            if (r !== undefined) close();
          }}
          noValidate
        >
          <Field label="Training center" htmlFor="cc-center" error={fieldErrors.centerId}>
            <Select id="cc-center" value={c} onChange={(e) => setC(e.target.value)} options={centers.map((x) => ({ value: x.id, label: `${x.name} (${x.code})${x.status !== "ACTIVE" ? ` · ${x.status.toLowerCase()}` : ""}` }))} />
          </Field>
          <Field label="Course" htmlFor="cc-course" error={localError ?? fieldErrors.courseId}>
            <Select id="cc-course" value={k} onChange={(e) => setK(e.target.value)} options={courses.map((x) => ({ value: x.id, label: `${x.name} (${x.code})` }))} invalid={!!localError} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!changed}>
              Apply change
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
