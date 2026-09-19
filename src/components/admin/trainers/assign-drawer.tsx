"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPinPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate, titleCase } from "@/lib/utils";

interface CenterOpt { id: string; name: string; code: string; status: string; district: { name: string }; state: { name: string } }
interface CourseOpt { id: string; name: string; code: string }
interface BatchOpt { id: string; name: string; code: string; status: string; courseId: string; startDate: string; days: string[]; startTime: string; endTime: string; trainer: { trainerId: string; user: { name: string } } | null }

export function AssignDrawer({ trainerId, trainerName, active }: { trainerId: string; trainerName: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [centers, setCenters] = React.useState<CenterOpt[]>([]);
  const [courses, setCourses] = React.useState<CourseOpt[]>([]);
  const [batches, setBatches] = React.useState<BatchOpt[]>([]);
  const [centerId, setCenterId] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const openDrawer = () => {
    setOpen(true);
    if (centers.length) return;
    setLoading(true);
    api
      .get<{ centers: CenterOpt[] }>("/api/admin/trainers/options")
      .then((d) => setCenters(d.centers))
      .catch(() => toast.error("Could not load training centers"))
      .finally(() => setLoading(false));
  };

  const selectCenter = (id: string) => {
    setCenterId(id);
    setCourses([]);
    setBatches([]);
    setCourseId("");
    setBatchId("");
    if (!id) return;
    setLoading(true);
    api
      .get<{ courses: CourseOpt[]; batches: BatchOpt[] }>(`/api/admin/trainers/options?centerId=${id}`)
      .then((d) => {
        setCourses(d.courses);
        setBatches(d.batches);
      })
      .catch(() => toast.error("Could not load courses for this center"))
      .finally(() => setLoading(false));
  };

  const visibleBatches = courseId ? batches.filter((b) => b.courseId === courseId) : batches;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.post(`/api/admin/trainers/${trainerId}/assignments`, { centerId, courseId: courseId || null, batchId: batchId || null, notes: notes || null });
      toast.success("Trainer assigned", `${trainerName} has been notified.`);
      setOpen(false);
      setCenterId("");
      setNotes("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={openDrawer} disabled={!active} title={active ? undefined : "Activate the trainer first"} leftIcon={<MapPinPlus className="h-4 w-4" />}>
        Assign to center
      </Button>
      <ResponsiveSheet open={open} onClose={() => !busy && setOpen(false)} title="Assign to a training center" description={`Choose where ${trainerName} will teach. Course and batch are optional.`}>
        <form onSubmit={submit} className="space-y-4" noValidate id="assign-form">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Training center" htmlFor="as-center" required error={errors.centerId}>
            <Select id="as-center" value={centerId} onChange={(e) => selectCenter(e.target.value)} placeholder={loading && !centers.length ? "Loading…" : "Select a center"} options={centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code}) · ${c.district.name}, ${c.state.name}${c.status !== "ACTIVE" ? ` · ${titleCase(c.status)}` : ""}` }))} invalid={!!errors.centerId} required />
          </Field>
          <Field label="Course (optional)" htmlFor="as-course" error={errors.courseId} hint={centerId && !loading && courses.length === 0 ? "This center has no courses configured." : undefined}>
            <Select id="as-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchId(""); }} placeholder={!centerId ? "Select a center first" : loading ? "Loading…" : "Any course"} options={courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} disabled={!centerId} invalid={!!errors.courseId} />
          </Field>
          <Field label="Batch (optional)" htmlFor="as-batch" error={errors.batchId} hint={batchId ? "The trainer becomes the batch trainer and current students are linked." : centerId && visibleBatches.length === 0 && !loading ? "No upcoming or ongoing batches match." : undefined}>
            <Select id="as-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder={!centerId ? "Select a center first" : "No specific batch"} options={visibleBatches.map((b) => ({ value: b.id, label: `${b.name} · ${titleCase(b.status)} · from ${formatDate(b.startDate)} · ${b.days.join("/")} ${b.startTime}–${b.endTime}${b.trainer ? ` · currently ${b.trainer.user.name}` : ""}` }))} disabled={!centerId} invalid={!!errors.batchId} />
          </Field>
          <Field label="Notes (optional)" htmlFor="as-notes" error={errors.notes}>
            <Textarea id="as-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Weekend batches only" />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!centerId}>
              Assign trainer
            </Button>
          </div>
        </form>
      </ResponsiveSheet>
    </>
  );
}
