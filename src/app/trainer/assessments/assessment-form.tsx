"use client";

import * as React from "react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Field, FormActions, FormGrid } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { ASSESSMENT_TYPES } from "@/components/trainer/grades";
import type { BatchOption } from "@/components/trainer/types";
import type { AssessmentRow } from "@/components/trainer/mobile/assessment-card";

export interface AssessmentFormProps {
  batch: BatchOption;
  /** `null` creates a new assessment. */
  assessment: AssessmentRow | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit form for an assessment; loaded on demand (next/dynamic) inside a ResponsiveSheet. */
export default function AssessmentForm({ batch, assessment, onClose, onSaved }: AssessmentFormProps) {
  const [title, setTitle] = React.useState(assessment?.title ?? "");
  const [type, setType] = React.useState(assessment?.type ?? "QUIZ");
  const [date, setDate] = React.useState(assessment?.date ? assessment.date.slice(0, 10) : "");
  const [maxMarks, setMaxMarks] = React.useState(String(assessment?.maxMarks ?? 100));
  const [passingMarks, setPassingMarks] = React.useState(String(assessment?.passingMarks ?? 40));
  const [weightage, setWeightage] = React.useState(String(assessment?.weightage ?? 1));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaving(true);
    const payload = { title: title.trim(), type, date, maxMarks: Number(maxMarks), passingMarks: Number(passingMarks), weightage: Number(weightage) };
    try {
      if (assessment) await api.patch(`/api/trainer/assessments/${assessment.id}`, payload);
      else await api.post("/api/trainer/assessments", { batchId: batch.id, ...payload });
      toast.success(assessment ? "Assessment updated" : "Assessment created", assessment && assessment.resultCount > 0 ? "Existing grades were recalculated." : undefined);
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.status === 422 && Object.keys(err.fieldErrors).length ? null : err.message);
      } else setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Field label="Title" htmlFor="asm-title" required error={errors.title}>
        <Input id="asm-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} maxLength={200} placeholder="e.g. Unit 2 quiz – Spreadsheets" />
      </Field>
      <FormGrid>
        <Field label="Type" htmlFor="asm-type" required error={errors.type}>
          <Select id="asm-type" value={type} onChange={(e) => setType(e.target.value)} invalid={!!errors.type} options={ASSESSMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        </Field>
        <Field label="Date" htmlFor="asm-date" error={errors.date} hint="Leave blank if not scheduled yet.">
          <DateInput id="asm-date" value={date} min={batch.startDate} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} />
        </Field>
      </FormGrid>
      <FormGrid cols={3}>
        <Field label="Max marks" htmlFor="asm-max" required error={errors.maxMarks}>
          <Input id="asm-max" type="number" min={1} max={1000} inputMode="numeric" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} invalid={!!errors.maxMarks} />
        </Field>
        <Field label="Passing marks" htmlFor="asm-pass" required error={errors.passingMarks}>
          <Input id="asm-pass" type="number" min={0} max={1000} inputMode="numeric" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} invalid={!!errors.passingMarks} />
        </Field>
        <Field label="Weightage" htmlFor="asm-weight" required error={errors.weightage} hint="Relative weight in the batch average.">
          <Input id="asm-weight" type="number" min={1} max={100} inputMode="numeric" value={weightage} onChange={(e) => setWeightage(e.target.value)} invalid={!!errors.weightage} />
        </Field>
      </FormGrid>
      <p className="text-xs text-muted">Grades: A+ (90%+), A (80%+), B (70%+), C (60%+), Pass (at or above passing marks), Fail (below passing marks).</p>
      <FormActions>
        <Button type="button" variant="outline" size="md" onClick={onClose} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" size="md" loading={saving} className="w-full sm:w-auto">
          {assessment ? "Save changes" : "Create assessment"}
        </Button>
      </FormActions>
    </form>
  );
}
