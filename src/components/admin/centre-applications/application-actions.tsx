"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Building2, CalendarClock, CheckCircle2, ExternalLink, FileSignature, FileWarning, ListChecks, MoreHorizontal, PenLine, RotateCcw, Star, Users, XCircle,
} from "lucide-react";
import type { CentreApplicationStatus } from "@/generated/prisma/enums";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ActionSheet } from "@/components/ui/action-sheet";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { toDateTimeLocal } from "@/components/admin/content/fields";
import { centreStatusLabel } from "./status";

/** Everything except APPROVED, which has its own "start the centre" action. */
type Target = Exclude<CentreApplicationStatus, "APPROVED">;

export interface CentreCourseOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  id: string;
  applicationNo: string;
  status: CentreApplicationStatus;
  allowedTransitions: CentreApplicationStatus[];
  verificationAt: string | null;
  orientationAt: string | null;
  orientationMode: string | null;
  agreementReference: string | null;
  /** Pre-filled values for the centre created at step 7. */
  approveDefaults: { centerName: string; capacity: number; phone: string };
  courses: CentreCourseOption[];
  can: { update: boolean; verify: boolean; approve: boolean; reject: boolean };
}

interface ActionDef {
  to: Target;
  label: string;
  icon: React.ReactNode;
  variant: "primary" | "outline" | "danger" | "navy";
  noteLabel: string;
  noteRequired: boolean;
  description: string;
  permission: "update" | "verify" | "reject";
}

const ORIENTATION_MODES = ["In person at the centre", "At the district office", "Online (video call)", "Hybrid"];

export function CentreApplicationActions({
  id,
  applicationNo,
  status,
  allowedTransitions,
  verificationAt,
  orientationAt,
  orientationMode,
  agreementReference,
  approveDefaults,
  courses,
  can,
}: Props) {
  const router = useRouter();
  const [action, setAction] = React.useState<ActionDef | null>(null);
  const [note, setNote] = React.useState("");
  const [visitAt, setVisitAt] = React.useState(toDateTimeLocal(verificationAt));
  const [orientAt, setOrientAt] = React.useState(toDateTimeLocal(orientationAt));
  const [mode, setMode] = React.useState(orientationMode ?? ORIENTATION_MODES[0]!);
  const [reference, setReference] = React.useState(agreementReference ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Step 7 – Centre Start
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [centerName, setCenterName] = React.useState(approveDefaults.centerName);
  const [capacity, setCapacity] = React.useState(String(approveDefaults.capacity));
  const [phone, setPhone] = React.useState(approveDefaults.phone);
  const [courseIds, setCourseIds] = React.useState<string[]>([]);
  const [created, setCreated] = React.useState<{ id: string; code: string; name: string } | null>(null);

  const has = (s: CentreApplicationStatus) => allowedTransitions.includes(s);
  const defs: ActionDef[] = [];
  if (has("UNDER_REVIEW"))
    defs.push(
      status === "REJECTED"
        ? { to: "UNDER_REVIEW", label: "Reconsider", icon: <RotateCcw className="h-4 w-4" />, variant: "outline", noteLabel: "Reason for reconsidering", noteRequired: false, description: "Re-opens the rejected application at step 2 of the process.", permission: "update" }
        : { to: "UNDER_REVIEW", label: "Move to Review", icon: <ListChecks className="h-4 w-4" />, variant: "navy", noteLabel: "Note (optional)", noteRequired: false, description: "Step 2 – the application and its documents are being checked by the Foundation.", permission: "update" }
    );
  if (has("DOCUMENTS_REQUIRED"))
    defs.push({ to: "DOCUMENTS_REQUIRED", label: "Request Documents", icon: <FileWarning className="h-4 w-4" />, variant: "outline", noteLabel: "Which documents are required?", noteRequired: true, description: "The applicant is notified and asked to upload the documents you list here.", permission: "update" });
  if (has("DOCUMENTS_VERIFIED"))
    defs.push({ to: "DOCUMENTS_VERIFIED", label: "Mark Documents Verified", icon: <BadgeCheck className="h-4 w-4" />, variant: "primary", noteLabel: "Verification note (optional)", noteRequired: false, description: "Step 2 complete – identity, address and qualification documents are in order.", permission: "verify" });
  if (has("CENTRE_VERIFICATION"))
    defs.push({ to: "CENTRE_VERIFICATION", label: "Schedule Centre Verification", icon: <CalendarClock className="h-4 w-4" />, variant: "navy", noteLabel: "Instructions for the applicant (optional)", noteRequired: false, description: "Step 3 – the applicant is notified of the visit date for the space and classroom check.", permission: "update" });
  if (has("SELECTED"))
    defs.push({ to: "SELECTED", label: "Select", icon: <Star className="h-4 w-4" />, variant: "primary", noteLabel: status === "CENTRE_VERIFICATION" ? "Centre verification notes" : "Note (optional)", noteRequired: false, description: "Step 4 – the application meets the Foundation standards for a Class 1–4 centre.", permission: "update" });
  if (has("AGREEMENT_PENDING"))
    defs.push({ to: "AGREEMENT_PENDING", label: "Start Agreement", icon: <FileSignature className="h-4 w-4" />, variant: "navy", noteLabel: "Note for the applicant (optional)", noteRequired: false, description: "Step 5 – the authorisation / agreement is being prepared with the operator.", permission: "update" });
  if (has("AGREEMENT_SIGNED"))
    defs.push({ to: "AGREEMENT_SIGNED", label: "Mark Agreement Signed", icon: <PenLine className="h-4 w-4" />, variant: "primary", noteLabel: "Note (optional)", noteRequired: false, description: "Step 5 complete – records the agreement reference and the signing date.", permission: "update" });
  if (has("ORIENTATION"))
    defs.push({ to: "ORIENTATION", label: "Schedule Orientation", icon: <Users className="h-4 w-4" />, variant: "navy", noteLabel: "Instructions for the applicant (optional)", noteRequired: false, description: "Step 6 – the operator and teachers are oriented before classes start.", permission: "update" });
  if (has("REJECTED"))
    defs.push({ to: "REJECTED", label: "Reject", icon: <XCircle className="h-4 w-4" />, variant: "danger", noteLabel: "Reason for rejection", noteRequired: true, description: "The applicant is notified with this reason. It can be reconsidered later.", permission: "reject" });

  const visible = defs.filter((d) => can[d.permission]);
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
      await api.post(`/api/admin/centre-applications/${id}/transition`, {
        to: action.to,
        note: note || null,
        verificationAt: action.to === "CENTRE_VERIFICATION" && visitAt ? new Date(visitAt).toISOString() : null,
        orientationAt: action.to === "ORIENTATION" && orientAt ? new Date(orientAt).toISOString() : null,
        orientationMode: action.to === "ORIENTATION" ? mode : null,
        agreementReference: action.to === "AGREEMENT_SIGNED" ? reference || null : null,
      });
      toast.success(`Application moved to ${centreStatusLabel(action.to)}`);
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

  const approve = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const center = await api.post<{ id: string; code: string; name: string }>(`/api/admin/centre-applications/${id}/approve`, {
        note: note || null,
        centerName: centerName.trim() || undefined,
        capacity: capacity === "" ? undefined : Number(capacity),
        phone: phone.trim() || null,
        courseIds,
      });
      setCreated(center);
      toast.success("Centre started", `${center.code} created and the applicant notified.`);
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

  const toggleCourse = (courseId: string) => setCourseIds((prev) => (prev.includes(courseId) ? prev.filter((c) => c !== courseId) : [...prev, courseId]));

  const none = visible.length === 0 && !canApprove;
  const primary = canApprove ? null : (visible[0] ?? null);
  const rest = canApprove ? visible : visible.slice(1);

  return (
    <div className="space-y-3">
      {/*
       * lg+: the buttons live in this Actions card. Below lg they move into the fixed StickyActionBar,
       * so the card (and never an ancestor of the bar) is what gets hidden on phones.
       */}
      <Card className="max-lg:hidden">
        <CardHeader
          title="Actions"
          description={
            status === "APPROVED"
              ? "The seven-step process is finished."
              : canApprove
                ? "Orientation done – approve to create the centre (step 7)."
                : "Move the application through the seven-step Shiksha Mission process."
          }
        />
        <CardBody className="space-y-3">
          {created && (
            <Alert tone="success" title={`Centre ${created.code} created`}>
              <Link href={`/admin/centers/${created.id}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                Open {created.name} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Alert>
          )}
          {none ? (
            <p className="text-sm text-muted">
              {status === "APPROVED"
                ? "This application is complete – the centre has been created."
                : allowedTransitions.length === 0
                  ? "No further actions are available."
                  : "You do not have permission to change this application."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {canApprove && (
                <Button fullWidth onClick={() => setApproveOpen(true)} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                  Approve &amp; start centre
                </Button>
              )}
              {visible.map((d) => (
                <Button key={d.to} variant={d.variant} size="sm" fullWidth onClick={() => open(d)} leftIcon={d.icon}>
                  {d.label}
                </Button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {!none && (
        <StickyActionBar desktop="hidden" innerClassName="gap-2">
          {canApprove ? (
            <span className="flex-1 *:w-full">
              <Button size="md" fullWidth onClick={() => setApproveOpen(true)} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                Approve &amp; start centre
              </Button>
            </span>
          ) : (
            primary && (
              <span className="flex-1 *:w-full">
                <Button size="md" variant={primary.variant === "outline" ? "navy" : primary.variant} fullWidth onClick={() => open(primary)} leftIcon={primary.icon}>
                  {primary.label}
                </Button>
              </span>
            )
          )}
          {rest.length > 0 && (
            <Button size="md" variant="outline" onClick={() => setSheetOpen(true)} leftIcon={<MoreHorizontal className="h-4 w-4" />}>
              More
            </Button>
          )}
        </StickyActionBar>
      )}

      <ActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`Application ${applicationNo}`}
        description="Move this centre application through the seven-step process."
        items={rest.map((d) => ({ label: d.label, icon: d.icon, description: d.description, danger: d.to === "REJECTED", onSelect: () => open(d) }))}
      />

      <BottomSheet open={!!action} onClose={() => !busy && setAction(null)} title={action?.label} description={action?.description} size="md">
        <form onSubmit={submit} className="space-y-4 pb-2" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          {action?.to === "CENTRE_VERIFICATION" && (
            <Field label="Verification visit date & time" htmlFor="ca-visit" required error={errors.verificationAt}>
              <Input id="ca-visit" type="datetime-local" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} invalid={!!errors.verificationAt} required />
            </Field>
          )}
          {action?.to === "ORIENTATION" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Orientation date & time" htmlFor="ca-orient" required error={errors.orientationAt}>
                <Input id="ca-orient" type="datetime-local" value={orientAt} onChange={(e) => setOrientAt(e.target.value)} invalid={!!errors.orientationAt} required />
              </Field>
              <Field label="Mode" htmlFor="ca-mode" required error={errors.orientationMode}>
                <Select id="ca-mode" value={mode} onChange={(e) => setMode(e.target.value)} options={ORIENTATION_MODES.map((m) => ({ value: m, label: m }))} required />
              </Field>
            </div>
          )}
          {action?.to === "AGREEMENT_SIGNED" && (
            <Field label="Agreement reference" htmlFor="ca-ref" hint="Agreement or authorisation number kept on file." error={errors.agreementReference}>
              <Input id="ca-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ESK/AGR/2026/0001" invalid={!!errors.agreementReference} />
            </Field>
          )}
          {action && (
            <Field label={action.noteLabel} htmlFor="ca-note" required={action.noteRequired} error={errors.note}>
              <Textarea id="ca-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} invalid={!!errors.note} required={action.noteRequired} />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="md" onClick={() => setAction(null)} disabled={busy} fullWidth className="sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" size="md" variant={action?.variant === "danger" ? "danger" : "primary"} loading={busy} fullWidth className="sm:w-auto">
              {action?.label}
            </Button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet
        open={approveOpen}
        onClose={() => !busy && setApproveOpen(false)}
        title={created ? "Centre started" : "Approve & start centre"}
        description={created ? undefined : "Step 7 – this creates the training centre record for the Class 1–4 centre. The details are pre-filled from the application; adjust them if needed."}
        size="lg"
      >
        {created ? (
          <div className="space-y-4 pb-2">
            <Alert tone="success" title={`Centre ${created.code} created`}>
              {created.name} is active and verified. The applicant has been notified with the centre code.
            </Alert>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Centre code</p>
              <p className="font-mono text-lg font-bold text-navy">{created.code}</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="md" onClick={() => setApproveOpen(false)} fullWidth className="sm:w-auto">
                Close
              </Button>
              <ButtonLink href={`/admin/centers/${created.id}`} size="md" className="w-full sm:w-auto" leftIcon={<Building2 className="h-4 w-4" />}>
                Open centre
              </ButtonLink>
            </div>
          </div>
        ) : (
          <form onSubmit={approve} className="space-y-4 pb-2" noValidate>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Centre name" htmlFor="ap-name" required error={errors.centerName} className="sm:col-span-2">
                <Input id="ap-name" value={centerName} onChange={(e) => setCenterName(e.target.value)} invalid={!!errors.centerName} required />
              </Field>
              <Field label="Seating capacity" htmlFor="ap-cap" error={errors.capacity}>
                <Input id="ap-cap" type="number" inputMode="numeric" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} invalid={!!errors.capacity} />
              </Field>
              <Field label="Contact phone" htmlFor="ap-phone" error={errors.phone}>
                <Input id="ap-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!errors.phone} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Courses offered at this centre</p>
              {courses.length === 0 ? (
                <p className="text-sm text-muted">No courses available yet. They can be attached to the centre later.</p>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {courses.map((c) => (
                    <Checkbox key={c.id} checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} label={c.name} description={c.code} className="rounded-xl border border-line bg-white p-3" />
                  ))}
                </div>
              )}
              {errors.courseIds && <p className="mt-1 text-xs font-medium text-danger">{errors.courseIds}</p>}
            </div>
            <Field label="Note (optional)" htmlFor="ap-note" error={errors.note}>
              <Textarea id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} invalid={!!errors.note} />
            </Field>
            <Alert tone="info">A permanent centre code is generated from the state and district, the centre is created Active and Verified, and the applicant is notified. This cannot be undone.</Alert>
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="md" onClick={() => setApproveOpen(false)} disabled={busy} fullWidth className="sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" size="md" loading={busy} fullWidth className="sm:w-auto" leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                Approve &amp; create centre
              </Button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
