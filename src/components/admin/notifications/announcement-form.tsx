"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, RadioCards } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";

interface Targets {
  centers: { id: string; name: string; code: string }[];
  batches: { id: string; name: string; code: string; status: string; center: { name: string }; course: { name: string } }[];
}

const AUDIENCES = [
  { value: "ALL", label: "Everyone", description: "All active students, trainers and staff" },
  { value: "STUDENTS", label: "Students", description: "Active admissions and open applications" },
  { value: "TRAINERS", label: "Trainers", description: "All active volunteer trainers" },
  { value: "CENTER", label: "A training center", description: "Students and trainers of one center" },
  { value: "BATCH", label: "A batch", description: "Students and the trainer of one batch" },
];

export function AnnouncementForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [targets, setTargets] = React.useState<Targets | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [audience, setAudience] = React.useState("ALL");
  const [centerId, setCenterId] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open || targets) return;
    api.get<Targets>("/api/admin/notifications/announcements/targets").then(setTargets).catch(() => toast.error("Could not load centers and batches"));
  }, [open, targets]);

  const submit = async (publish: boolean) => {
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api.post<{ recipients: number }>("/api/admin/notifications/announcements", { title, body, audience, centerId: centerId || null, batchId: batchId || null, publish });
      toast.success(publish ? "Announcement published" : "Announcement saved as draft", publish ? `Delivered to ${res.recipients} recipient${res.recipients === 1 ? "" : "s"} in-app.` : undefined);
      setOpen(false);
      setTitle("");
      setBody("");
      setAudience("ALL");
      setCenterId("");
      setBatchId("");
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
      <Button size="sm" onClick={() => setOpen(true)} leftIcon={<Megaphone className="h-4 w-4" />}>
        New announcement
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="New announcement" description="Published announcements are delivered as in-app notifications to the chosen audience." size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
          className="space-y-4"
          noValidate
        >
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Title" htmlFor="an-title" required error={errors.title}>
            <Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} required />
          </Field>
          <Field label="Message" htmlFor="an-body" required error={errors.body}>
            <Textarea id="an-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} invalid={!!errors.body} required />
          </Field>
          <Field label="Audience" required error={errors.audience}>
            <RadioCards name="audience" value={audience} onChange={setAudience} options={AUDIENCES} columns={3} />
          </Field>
          {audience === "CENTER" && (
            <Field label="Training center" htmlFor="an-center" required error={errors.centerId}>
              <Select id="an-center" value={centerId} onChange={(e) => setCenterId(e.target.value)} placeholder={targets ? "Select a center" : "Loading…"} options={(targets?.centers ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} invalid={!!errors.centerId} required />
            </Field>
          )}
          {audience === "BATCH" && (
            <Field label="Batch" htmlFor="an-batch" required error={errors.batchId}>
              <Select id="an-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder={targets ? "Select a batch" : "Loading…"} options={(targets?.batches ?? []).map((b) => ({ value: b.id, label: `${b.name} · ${b.course.name} · ${b.center.name} · ${titleCase(b.status)}` }))} invalid={!!errors.batchId} required />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => void submit(false)} disabled={busy}>
              Save draft
            </Button>
            <Button type="submit" loading={busy} leftIcon={<Send className="h-4 w-4" />}>
              Publish now
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AnnouncementRowActions({ id, isPublished, title }: { id: string; isPublished: boolean; title: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<"publish" | "delete" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      if (confirm === "publish") {
        const r = await api.post<{ recipients: number }>(`/api/admin/notifications/announcements/${id}`);
        toast.success("Announcement published", `Delivered to ${r.recipients} recipient${r.recipients === 1 ? "" : "s"}.`);
      } else {
        await api.delete(`/api/admin/notifications/announcements/${id}`);
        toast.success("Announcement deleted");
      }
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inline-flex items-center gap-1">
      {!isPublished && (
        <Button size="xs" variant="navy" onClick={() => setConfirm("publish")} leftIcon={<Send className="h-3.5 w-3.5" />}>
          Publish
        </Button>
      )}
      <button type="button" onClick={() => setConfirm("delete")} className="rounded-lg p-1.5 text-muted hover:bg-danger-light hover:text-danger" aria-label={`Delete announcement ${title}`}>
        <Trash2 className="h-4 w-4" />
      </button>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={run}
        title={confirm === "publish" ? "Publish this announcement?" : "Delete this announcement?"}
        description={confirm === "publish" ? `"${title}" will be delivered in-app to its audience now.` : `"${title}" will be removed. Notifications already delivered are kept.`}
        confirmLabel={confirm === "publish" ? "Publish" : "Delete"}
        danger={confirm === "delete"}
        loading={busy}
      />
    </div>
  );
}
