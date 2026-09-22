"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarClock, CheckCircle2, FileWarning, ListChecks, RotateCcw, Star, XCircle } from "lucide-react";
import type { TrainerApplicationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { toDateTimeLocal } from "@/components/admin/content/fields";

type Target = Exclude<TrainerApplicationStatus, "APPROVED">;

interface Props {
  id: string;
  status: TrainerApplicationStatus;
  allowedTransitions: TrainerApplicationStatus[];
  interviewAt: string | Date | null;
  interviewMode: string | null;
  can: { update: boolean; reject: boolean; approve: boolean };
}

interface ActionDef {
  to: Target;
  label: string;
  icon: React.ReactNode;
  variant: "primary" | "outline" | "danger" | "navy";
  noteLabel: string;
  noteRequired: boolean;
  description: string;
}

const INTERVIEW_MODES = ["In person", "Phone call", "Video call"];

export function ApplicationActions({ id, status, allowedTransitions, interviewAt, interviewMode, can }: Props) {
  const router = useRouter();
  const [action, setAction] = React.useState<ActionDef | null>(null);
  const [note, setNote] = React.useState("");
  const [when, setWhen] = React.useState(toDateTimeLocal(interviewAt));
  const [mode, setMode] = React.useState(interviewMode ?? "In person");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [approved, setApproved] = React.useState<{ id: string; trainerId: string } | null>(null);

  const defs: ActionDef[] = [];
  const has = (s: TrainerApplicationStatus) => allowedTransitions.includes(s);
  if (has("UNDER_REVIEW"))
    defs.push(status === "REJECTED"
      ? { to: "UNDER_REVIEW", label: "Reconsider", icon: <RotateCcw className="h-4 w-4" />, variant: "outline", noteLabel: "Reason for reconsidering", noteRequired: false, description: "Re-opens the rejected application for review." }
      : { to: "UNDER_REVIEW", label: "Move to Review", icon: <ListChecks className="h-4 w-4" />, variant: "navy", noteLabel: "Note (optional)", noteRequired: false, description: "Marks the application as being reviewed by the Foundation." });
  if (has("DOCUMENTS_REQUIRED")) defs.push({ to: "DOCUMENTS_REQUIRED", label: "Request Documents", icon: <FileWarning className="h-4 w-4" />, variant: "outline", noteLabel: "Which documents are required?", noteRequired: true, description: "The applicant is notified and asked to upload the documents you list here." });
  if (has("SHORTLISTED")) defs.push({ to: "SHORTLISTED", label: "Shortlist", icon: <Star className="h-4 w-4" />, variant: "navy", noteLabel: "Note (optional)", noteRequired: false, description: "Shortlists the applicant for an interview." });
  if (has("INTERVIEW")) defs.push({ to: "INTERVIEW", label: "Schedule Interview", icon: <CalendarClock className="h-4 w-4" />, variant: "navy", noteLabel: "Instructions for the applicant (optional)", noteRequired: false, description: "The applicant is notified with the date, time and mode." });
  if (has("VERIFIED")) defs.push({ to: "VERIFIED", label: "Mark Verified", icon: <BadgeCheck className="h-4 w-4" />, variant: "primary", noteLabel: status === "INTERVIEW" ? "Interview notes" : "Verification note (optional)", noteRequired: false, description: "Confirms documents and interview are satisfactory. The application can then be approved." });
  if (has("REJECTED")) defs.push({ to: "REJECTED", label: "Reject", icon: <XCircle className="h-4 w-4" />, variant: "danger", noteLabel: "Reason for rejection", noteRequired: true, description: "The applicant is notified with this reason." });

  const visible = defs.filter((d) => (d.to === "REJECTED" ? can.reject : can.update));
  const canApprove = has("APPROVED") && can.approve;

  const open = (d: ActionDef) => {
    setAction(d);
    setNote("");
    setErrors({});
    setFormError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.post(`/api/admin/trainer-applications/${id}/transition`, {
        to: action.to,
        note: note || null,
        interviewAt: action.to === "INTERVIEW" && when ? new Date(when).toISOString() : null,
        interviewMode: action.to === "INTERVIEW" ? mode : null,
      });
      toast.success(`Application moved to ${action.to.replace(/_/g, " ").toLowerCase()}`);
      setAction(null);
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

  const approve = async () => {
    setBusy(true);
    try {
      const t = await api.post<{ id: string; trainerId: string }>(`/api/admin/trainer-applications/${id}/approve`, {});
      setApproved(t);
      setApproveOpen(false);
      toast.success("Trainer approved", `Trainer ID ${t.trainerId} issued.`);
      router.refresh();
    } catch (err) {
      toast.error("Could not approve", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (approved) {
    return (
      <Alert tone="success" title={`Approved · Trainer ID ${approved.trainerId}`}>
        A trainer account has been created and the applicant has been notified with login details.{" "}
        <Link href={`/admin/trainers/${approved.id}`} className="font-semibold underline underline-offset-2">
          Open trainer profile
        </Link>
      </Alert>
    );
  }

  if (visible.length === 0 && !canApprove) {
    return <p className="text-body-sm text-muted">{status === "APPROVED" ? "This application has been approved." : allowedTransitions.length === 0 ? "No further actions are available." : "You do not have permission to change this application."}</p>;
  }

  return (
    <div className="space-y-3">
      {status === "VERIFIED" && canApprove && (
        <Button fullWidth onClick={() => setApproveOpen(true)} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
          Approve &amp; issue Trainer ID
        </Button>
      )}
      <div className="grid grid-cols-1 gap-2">
        {visible.map((d) => (
          <Button key={d.to} variant={d.variant} size="sm" fullWidth onClick={() => open(d)} leftIcon={d.icon}>
            {d.label}
          </Button>
        ))}
      </div>

      <Modal open={!!action} onClose={() => !busy && setAction(null)} title={action?.label} description={action?.description} size="md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          {action?.to === "INTERVIEW" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Interview date & time" htmlFor="iv-when" required error={errors.interviewAt}>
                <Input id="iv-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} invalid={!!errors.interviewAt} required />
              </Field>
              <Field label="Mode" htmlFor="iv-mode" error={errors.interviewMode}>
                <Select id="iv-mode" value={mode} onChange={(e) => setMode(e.target.value)} options={INTERVIEW_MODES.map((m) => ({ value: m, label: m }))} />
              </Field>
            </div>
          )}
          {action && (
            <Field label={action.noteLabel} htmlFor="act-note" required={action.noteRequired} error={errors.note}>
              <Textarea id="act-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} invalid={!!errors.note} required={action.noteRequired} />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAction(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant={action?.variant === "danger" ? "danger" : "primary"} loading={busy}>
              {action?.label}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={approveOpen}
        onClose={() => !busy && setApproveOpen(false)}
        onConfirm={approve}
        title="Approve this trainer application?"
        description={
          <ul className="list-disc space-y-1 pl-5">
            <li>A unique Trainer ID will be generated.</li>
            <li>A trainer login account will be created (or linked if the email/mobile already belongs to a trainer) and the applicant will receive credentials.</li>
            <li>Verified documents move to the trainer&rsquo;s profile.</li>
            <li>This cannot be undone.</li>
          </ul>
        }
        confirmLabel="Approve & create trainer"
        loading={busy}
      />
    </div>
  );
}
