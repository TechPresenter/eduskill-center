"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Fab } from "@/components/ui/fab";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CourseFaqDto } from "@/server/course-cms";
import { DragHandle, ReorderButtons, SortInstructions, SortStatus, sortableRowClasses, useSortable } from "@/components/admin/courses/sortable";

/**
 * Per-course FAQ. Separate from the site-wide FAQ table on purpose — these answer questions about
 * *this* course and are ordered independently.
 */

interface FaqForm {
  question: string;
  answer: string;
  isActive: boolean;
}

const blankForm: FaqForm = { question: "", answer: "", isActive: true };
const toForm = (f: CourseFaqDto): FaqForm => ({ question: f.question, answer: f.answer, isActive: f.isActive });

export function CourseFaqManager({ courseId, faqs, canEdit }: { courseId: string; faqs: CourseFaqDto[]; canEdit: boolean }) {
  const router = useRouter();
  const formId = React.useId();
  const [editing, setEditing] = React.useState<CourseFaqDto | "new" | null>(null);
  const [values, setValues] = React.useState<FaqForm>(blankForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CourseFaqDto | null>(null);
  const [removing, setRemoving] = React.useState(false);

  const ids = React.useMemo(() => faqs.map((f) => f.id), [faqs]);
  const byId = React.useMemo(() => new Map(faqs.map((f) => [f.id, f])), [faqs]);
  const labelOf = React.useCallback((id: string) => byId.get(id)?.question ?? "Question", [byId]);

  const onCommit = React.useCallback(
    async (next: string[]) => {
      try {
        await api.post(`/api/admin/courses/${courseId}/faqs/reorder`, { ids: next });
        router.refresh();
      } catch (err) {
        toast.error("Could not save the new order", errorMessage(err));
        throw err;
      }
    },
    [courseId, router]
  );

  const sortable = useSortable({ ids, labelOf, onCommit, disabled: !canEdit });
  const ordered = sortable.order.map((id) => byId.get(id)).filter((f): f is CourseFaqDto => !!f);

  const set = <K extends keyof FaqForm>(k: K, v: FaqForm[K]) => setValues((cur) => ({ ...cur, [k]: v }));

  const open = (target: CourseFaqDto | "new") => {
    setValues(target === "new" ? blankForm : toForm(target));
    setErrors({});
    setFormError(null);
    setEditing(target);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      if (editing === "new") await api.post(`/api/admin/courses/${courseId}/faqs`, values);
      else await api.put(`/api/admin/courses/${courseId}/faqs/${editing.id}`, values);
      toast.success(editing === "new" ? "Question added" : "Question updated");
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await api.delete(`/api/admin/courses/${courseId}/faqs/${deleting.id}`);
      toast.success("Question removed");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete the question", errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const shown = faqs.filter((f) => f.isActive).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Course FAQs"
          description={faqs.length === 0 ? "The questions people ask about this course, in the order they should be answered." : `${faqs.length} question${faqs.length === 1 ? "" : "s"} · ${shown} shown on the site`}
          action={
            canEdit ? (
              <Button size="sm" onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
                Add question
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          {faqs.length === 0 ? (
            <EmptyState
              icon={<HelpCircle className="h-7 w-7" />}
              title="No questions yet"
              description="Add what parents and students ask most about this course — fees, eligibility, certificates, timings. They appear on the course page in this order."
              action={
                canEdit ? (
                  <Button onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />}>
                    Add the first question
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <SortInstructions id={sortable.instructionsId} itemLabel="question" />
              <SortStatus message={sortable.message} />
              {canEdit && faqs.length > 1 && <p className="mb-3 text-caption text-muted">Drag the handle to reorder, or focus it and use the arrow keys.</p>}
              <ol className="space-y-2">
                {ordered.map((faq, i) => {
                  const actions = (
                    <>
                      {canEdit && <ReorderButtons sortable={sortable} id={faq.id} what={faq.question} />}
                      {canEdit && <IconButton size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`Edit "${faq.question}"`} onClick={() => open(faq)} />}
                      {canEdit && <IconButton size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Delete "${faq.question}"`} onClick={() => setDeleting(faq)} className="hover:bg-danger-light hover:text-danger" />}
                    </>
                  );
                  return (
                    <li key={faq.id}>
                      <div {...sortable.rowProps(faq.id)} className={cn("flex items-start gap-1 rounded-card border border-line bg-white pr-1.5", sortableRowClasses(sortable, faq.id), sortable.saving && "opacity-70")}>
                        {canEdit && <DragHandle sortable={sortable} id={faq.id} className="mt-1.5" />}
                        <div className="min-w-0 flex-1 py-3 pl-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-caption font-semibold text-muted tabular-nums">{i + 1}.</span>
                            <span className="min-w-0 font-semibold text-navy">{faq.question}</span>
                            {!faq.isActive && <Badge tone="neutral">Hidden</Badge>}
                          </div>
                          <p className="mt-1.5 text-body-sm whitespace-pre-line text-muted">{faq.answer}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-0.5 sm:hidden">{actions}</div>
                        </div>
                        <div className="hidden shrink-0 items-center gap-0.5 py-3 sm:flex">{actions}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </CardBody>
      </Card>

      {canEdit && <Fab aria-label="Add question" icon={<Plus className="h-6 w-6" aria-hidden />} onClick={() => open("new")} />}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        size="lg"
        title={editing === "new" ? "Add question" : "Edit question"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {editing === "new" ? "Add question" : "Save changes"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Question" required error={errors.question}>
            <Input value={values.question} onChange={(e) => set("question", e.target.value)} disabled={saving} maxLength={300} placeholder="Is a certificate given at the end?" />
          </Field>
          <Field label="Answer" required error={errors.answer}>
            <Textarea value={values.answer} onChange={(e) => set("answer", e.target.value)} rows={6} disabled={saving} maxLength={5000} />
          </Field>
          <Checkbox checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} disabled={saving} label="Show on the course page" description="Turn this off to keep the question while you finish the answer." />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete this question?" description={deleting ? `"${deleting.question}" will be removed from this course.` : null} confirmLabel="Delete" danger loading={removing} />
    </div>
  );
}
