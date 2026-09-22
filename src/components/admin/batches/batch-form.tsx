"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormActions, FormGrid, FormSection } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { cn, titleCase } from "@/lib/utils";
import { useApiForm } from "@/components/admin/shared/use-api-form";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface BatchFormOptions {
  centers: { id: string; code: string; name: string; state: string; courses: { id: string; name: string; code: string; status: string }[] }[];
  trainers: { id: string; trainerId: string; name: string; level: string; centerIds: string[] }[];
}

export interface BatchFormInitial {
  id: string;
  name: string;
  centerId: string;
  courseId: string;
  trainerId: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  days: string[];
  capacity: number;
  room: string | null;
  status: string;
  notes: string | null;
  occupied: number;
}

export interface SavedBatch {
  id: string;
  code: string;
  name: string;
}

/**
 * Create / edit form for a batch. Used as a full page (/admin/batches/new, /edit) and inside
 * the center detail drawer (`lockCenterId`). Posts to the existing batches API.
 */
export function BatchForm({ options, initial, lockCenterId, onSaved, onCancel, compact }: { options: BatchFormOptions; initial?: BatchFormInitial; lockCenterId?: string; onSaved?: (batch: SavedBatch) => void; onCancel?: () => void; compact?: boolean }) {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [centerId, setCenterId] = React.useState(initial?.centerId ?? lockCenterId ?? "");
  const [courseId, setCourseId] = React.useState(initial?.courseId ?? "");
  const [trainerId, setTrainerId] = React.useState(initial?.trainerId ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [startDate, setStartDate] = React.useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = React.useState(initial?.endDate ?? "");
  const [startTime, setStartTime] = React.useState(initial?.startTime ?? "10:00");
  const [endTime, setEndTime] = React.useState(initial?.endTime ?? "12:00");
  const [days, setDays] = React.useState<string[]>(initial?.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [capacity, setCapacity] = React.useState(String(initial?.capacity ?? 30));
  const [room, setRoom] = React.useState(initial?.room ?? "");
  const [status, setStatus] = React.useState(initial?.status ?? "UPCOMING");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const center = options.centers.find((c) => c.id === centerId);
  const courses = center?.courses ?? [];
  const completed = initial?.status === "COMPLETED";
  const trainerOptions = React.useMemo(() => {
    const here = options.trainers.filter((t) => centerId && t.centerIds.includes(centerId));
    const others = options.trainers.filter((t) => !here.includes(t));
    const label = (t: BatchFormOptions["trainers"][number], tag?: string) => ({ value: t.id, label: `${t.name} (${t.trainerId}) · ${titleCase(t.level)} level${tag ? ` · ${tag}` : ""}` });
    return [...here.map((t) => label(t, "assigned at this center")), ...others.map((t) => label(t))];
  }, [options.trainers, centerId]);

  const toggleDay = (d: string) => {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...DAYS].filter((x) => cur.includes(x) || x === d)));
    clearField("days");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name, centerId, courseId, trainerId: trainerId || "", startDate, endDate, startTime, endTime, days, capacity: Number(capacity), room: room || "", notes: notes || "", ...(initial ? { status } : {}) };
    const res = await submit(() => (initial ? api.put<SavedBatch>(`/api/admin/batches/${initial.id}`, body) : api.post<SavedBatch>("/api/admin/batches", body)), { silent: true });
    if (!res) return;
    toast.success(initial ? "Batch updated" : "Batch created", `${res.code} · ${res.name}`);
    if (onSaved) onSaved(res);
    else {
      router.push(`/admin/batches/${res.id}`);
      router.refresh();
    }
  };

  const cols = compact ? 1 : 2;

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {error && Object.keys(fieldErrors).length > 0 && <Alert tone="warning">{error}</Alert>}

      <FormSection title="Where & what" description="Batches belong to one course at one training center. The batch code is generated from the center code.">
        <FormGrid cols={cols}>
          <Field label="Training center" htmlFor="bf-center" required error={fieldErrors.centerId} hint={initial && initial.occupied > 0 ? "Center cannot change once students are enrolled." : undefined}>
            <Select
              id="bf-center"
              value={centerId}
              onChange={(e) => {
                setCenterId(e.target.value);
                setCourseId("");
                clearField("centerId");
              }}
              options={options.centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code}) · ${c.state}` }))}
              placeholder="Select a center"
              required
              disabled={!!lockCenterId || (!!initial && initial.occupied > 0)}
              invalid={!!fieldErrors.centerId}
            />
          </Field>
          <Field label="Course" htmlFor="bf-course" required error={fieldErrors.courseId} hint={centerId && courses.length === 0 ? "This center offers no courses yet – add courses to the center first." : undefined}>
            <Select
              id="bf-course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                clearField("courseId");
              }}
              options={courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})${c.status !== "ACTIVE" ? ` · ${titleCase(c.status)}` : ""}` }))}
              placeholder={centerId ? "Select a course" : "Select a center first"}
              required
              disabled={!centerId || (!!initial && initial.occupied > 0)}
              invalid={!!fieldErrors.courseId}
            />
          </Field>
          <Field label="Batch name" htmlFor="bf-name" required error={fieldErrors.name} className={cn(cols === 2 && "sm:col-span-2")}>
            <Input id="bf-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} placeholder="e.g. Morning batch – Jan 2026" required maxLength={120} invalid={!!fieldErrors.name} />
          </Field>
          <Field label="Trainer" htmlFor="bf-trainer" error={fieldErrors.trainerId} hint="Optional. Assigning a trainer here also records a trainer assignment for this batch." className={cn(cols === 2 && "sm:col-span-2")}>
            <Select id="bf-trainer" value={trainerId} onChange={(e) => { setTrainerId(e.target.value); clearField("trainerId"); }} options={trainerOptions} placeholder="No trainer yet" invalid={!!fieldErrors.trainerId} disabled={completed} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Schedule">
        <FormGrid cols={cols}>
          <Field label="Start date" htmlFor="bf-start" required error={fieldErrors.startDate}>
            <Input id="bf-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); clearField("startDate"); }} required invalid={!!fieldErrors.startDate} />
          </Field>
          <Field label="End date" htmlFor="bf-end" required error={fieldErrors.endDate}>
            <Input id="bf-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => { setEndDate(e.target.value); clearField("endDate"); }} required invalid={!!fieldErrors.endDate} />
          </Field>
          <Field label="Start time" htmlFor="bf-st" required error={fieldErrors.startTime}>
            <Input id="bf-st" type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); clearField("startTime"); }} required invalid={!!fieldErrors.startTime} />
          </Field>
          <Field label="End time" htmlFor="bf-et" required error={fieldErrors.endTime}>
            <Input id="bf-et" type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); clearField("endTime"); }} required invalid={!!fieldErrors.endTime} />
          </Field>
        </FormGrid>
        <Field label="Class days" required error={fieldErrors.days}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Class days">
            {DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={on} className={cn("h-11 rounded-md border px-3.5 text-body-sm font-semibold transition-colors duration-micro motion-reduce:transition-none sm:h-9 sm:px-3", on ? "border-orange bg-orange-light text-orange" : "border-line bg-white text-muted hover:border-navy/40 hover:text-ink")}>
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Seats & details">
        <FormGrid cols={cols}>
          <Field label="Capacity (seats)" htmlFor="bf-cap" required error={fieldErrors.capacity} hint={initial ? `${initial.occupied} seat${initial.occupied === 1 ? "" : "s"} currently occupied or reserved.` : "Approved applications reserve a seat until admission is confirmed."}>
            <Input id="bf-cap" type="number" min={initial?.occupied || 1} max={1000} value={capacity} onChange={(e) => { setCapacity(e.target.value); clearField("capacity"); }} required invalid={!!fieldErrors.capacity} />
          </Field>
          <Field label="Room / hall" htmlFor="bf-room" error={fieldErrors.room}>
            <Input id="bf-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} placeholder="e.g. Lab 2" />
          </Field>
          {initial && (
            <Field label="Status" htmlFor="bf-status" error={fieldErrors.status} hint={completed ? "Completed batches cannot change status." : "Use the batch page to complete a batch – that also completes its admissions."}>
              <Select
                id="bf-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={completed ? [{ value: "COMPLETED", label: "Completed" }] : [{ value: "UPCOMING", label: "Upcoming" }, { value: "ONGOING", label: "Ongoing" }, { value: "CANCELLED", label: "Cancelled" }]}
                disabled={completed}
              />
            </Field>
          )}
          <Field label="Notes" htmlFor="bf-notes" error={fieldErrors.notes} className={cn(cols === 2 && "sm:col-span-2")}>
            <Textarea id="bf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="Internal notes for staff and the trainer" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Create batch"}
        </Button>
      </FormActions>
    </form>
  );
}
