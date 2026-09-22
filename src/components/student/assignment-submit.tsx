"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";

export function AssignmentSubmit({ assignmentId, hasSubmission, overdue, initialText }: { assignmentId: string; hasSubmission: boolean; overdue: boolean; initialText: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(!hasSubmission);
  const [text, setText] = React.useState(initialText);
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ status: string }>(`/api/student/assignments/${assignmentId}/submit`, { text: text || null, fileUrl: file?.url ?? null });
      toast.success(hasSubmission ? "Submission updated" : "Assignment submitted", r.status === "LATE" ? "Submitted after the due date – marked as late." : undefined);
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fieldErrors);
      toast.error("Could not submit", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" size="md" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        {hasSubmission ? "Replace submission" : "Submit assignment"}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-dashed border-line p-4" noValidate>
      {overdue && <Alert tone="warning">The due date has passed. You can still submit, but it will be marked as late.</Alert>}
      <Field label="Your answer" htmlFor={`text-${assignmentId}`} error={errors.text} hint="Type your answer, attach a file, or both.">
        <Textarea id={`text-${assignmentId}`} rows={4} value={text} onChange={(e) => setText(e.target.value)} invalid={!!errors.text} />
      </Field>
      <Field label="Attachment (optional)" hint="PDF, DOC, images or ZIP up to 20 MB.">
        <FileUpload endpoint="/api/student/uploads?kind=assignment" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt" maxSizeMb={20} value={file} onChange={setFile} sources={["camera", "gallery", "files"]} capture="environment" label="Upload file" />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {hasSubmission && (
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy} leftIcon={<Send className="h-4 w-4" />}>
          {hasSubmission ? "Update submission" : "Submit"}
        </Button>
      </div>
    </form>
  );
}
