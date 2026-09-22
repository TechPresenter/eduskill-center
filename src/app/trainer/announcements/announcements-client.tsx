"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Send } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormActions } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/tabs";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Fab } from "@/components/ui/fab";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import type { BatchOption } from "@/components/trainer/types";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
  mine: boolean;
  batch: { id: string; code: string; name: string } | null;
  center: { id: string; code: string; name: string } | null;
}

const AUDIENCE: Record<string, { label: string; tone: BadgeTone }> = {
  ALL: { label: "Everyone", tone: "navy" },
  TRAINERS: { label: "Trainers", tone: "info" },
  CENTER: { label: "Center", tone: "orange" },
  BATCH: { label: "Batch", tone: "success" },
  STUDENTS: { label: "Students", tone: "neutral" },
};

type Filter = "all" | "batch" | "center" | "foundation";

export function AnnouncementsClient({ batches, announcements, initialBatchId, disabled }: { batches: BatchOption[]; announcements: AnnouncementItem[]; initialBatchId: string; disabled: boolean }) {
  const router = useRouter();
  const postable = batches.filter((b) => b.status !== "CANCELLED");
  const canPost = !disabled && postable.length > 0;
  const initialValid = postable.some((b) => b.id === initialBatchId);
  const [open, setOpen] = React.useState(canPost && initialValid);
  const [filter, setFilter] = React.useState<Filter>("all");

  const visible = announcements.filter((a) => (filter === "all" ? true : filter === "batch" ? a.audience === "BATCH" : filter === "center" ? a.audience === "CENTER" : a.audience === "ALL" || a.audience === "TRAINERS"));

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          scrollable
          items={[
            { value: "all", label: `All (${announcements.length})` },
            { value: "batch", label: "My batches" },
            { value: "center", label: "My centers" },
            { value: "foundation", label: "Foundation" },
          ]}
        />
        <Button onClick={() => setOpen(true)} disabled={!canPost} leftIcon={<Plus className="h-4 w-4" />} className="hidden shrink-0 lg:inline-flex">
          New announcement
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-7 w-7" />}
          title={announcements.length === 0 ? "No announcements yet" : "Nothing in this category"}
          description={
            announcements.length === 0
              ? "Announcements from the Foundation and your centers will appear here. You can also post notices to your batches."
              : "Switch to another filter to see the rest."
          }
          action={
            canPost && (
              <Button onClick={() => setOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Post to a batch
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => {
            const aud = AUDIENCE[a.audience] ?? { label: a.audience, tone: "neutral" as BadgeTone };
            return (
              <li key={a.id} className="card card-p">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 flex-1 text-h4 text-navy">{a.title}</h3>
                  <Badge tone={aud.tone}>{a.audience === "BATCH" && a.batch ? a.batch.code : a.audience === "CENTER" && a.center ? a.center.code : aud.label}</Badge>
                  {a.mine && <Badge tone="neutral">Posted by you</Badge>}
                </div>
                <p className="mt-1 text-caption text-muted">
                  {a.audience === "BATCH" && a.batch ? `${a.batch.name} · ` : a.audience === "CENTER" && a.center ? `${a.center.name} · ` : ""}
                  {formatDateTime(a.createdAt)}
                </p>
                <p className="mt-3 text-body whitespace-pre-wrap text-ink">{a.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      {canPost && <Fab aria-label="New batch announcement" icon={<Plus className="h-6 w-6" />} label="Post" onClick={() => setOpen(true)} />}

      <ResponsiveSheet open={open} onClose={() => setOpen(false)} title="New batch announcement" description="Sent as an in-app notification to every active student of the batch." size="lg">
        {open && (
          <AnnouncementForm
            batches={postable}
            initialBatchId={initialValid ? initialBatchId : ""}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </ResponsiveSheet>
    </>
  );
}

function AnnouncementForm({ batches, initialBatchId, onClose, onSaved }: { batches: BatchOption[]; initialBatchId: string; onClose: () => void; onSaved: () => void }) {
  const [batchId, setBatchId] = React.useState(() => (batches.some((b) => b.id === initialBatchId) ? initialBatchId : (batches.find((b) => b.status === "ONGOING")?.id ?? batches[0]?.id ?? "")));
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const batch = batches.find((b) => b.id === batchId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const r = await api.post<{ notified: number }>("/api/trainer/announcements", { batchId, title: title.trim(), body: body.trim() });
      toast.success("Announcement posted", `${r.notified} student${r.notified === 1 ? "" : "s"} notified.`);
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
      <BatchPicker batches={batches} value={batchId} onChange={setBatchId} error={errors.batchId} id="ann-batch" />
      {batch && (
        <p className="-mt-3 text-caption text-muted">
          {batch.students} active student{batch.students === 1 ? "" : "s"} · {batch.centerName}
        </p>
      )}
      <Field label="Title" htmlFor="ann-title" required error={errors.title}>
        <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} maxLength={200} placeholder="e.g. No class on Friday" />
      </Field>
      <Field label="Message" htmlFor="ann-body" required error={errors.body} hint={`${body.length} / 5000`}>
        <Textarea id="ann-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} invalid={!!errors.body} maxLength={5000} placeholder="Write the full notice students should read." />
      </Field>
      <FormActions>
        <Button type="button" variant="outline" size="md" onClick={onClose} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" size="md" loading={saving} leftIcon={<Send className="h-4 w-4" />} className="w-full sm:w-auto">
          Post announcement
        </Button>
      </FormActions>
    </form>
  );
}
