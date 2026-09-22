"use client";

import * as React from "react";
import { Award, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatINR, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/feedback";
import { useMutation } from "@/components/admin/pickers/use-mutation";

export interface ScholarshipProgramOption {
  id: string;
  name: string;
  type: string;
  percentage: number | null;
  fixedAmount: number | null;
  maxAmount: number | null;
}

export interface ScholarshipDecisionFormProps {
  /** POST endpoint accepting `{ status, programId?, scholarshipAmount?, percentage?, remarks? }`. */
  endpoint: string;
  /** Extra body fields (e.g. `applicationId` for the module-level endpoint). */
  extraBody?: Record<string, unknown>;
  originalFee: number;
  discountAmount: number;
  programs: ScholarshipProgramOption[];
  initial?: { programId?: string | null; amount?: number | null; remarks?: string | null };
  disabled?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

type Mode = "program" | "percentage" | "amount";

function computeAmount(mode: Mode, program: ScholarshipProgramOption | undefined, value: number, originalFee: number) {
  let amount = 0;
  if (mode === "amount") amount = value;
  else if (mode === "percentage") amount = (originalFee * value) / 100;
  else if (program?.fixedAmount) amount = program.fixedAmount;
  else if (program?.percentage) amount = (originalFee * program.percentage) / 100;
  if (program?.maxAmount && amount > program.maxAmount) amount = program.maxAmount;
  return Math.round(amount * 100) / 100;
}

/** Scholarship decision form shared by the application detail panel and the Scholarships module's quick-decide drawer. */
export function ScholarshipDecisionForm({ endpoint, extraBody, originalFee, discountAmount, programs, initial, disabled, onDone, onCancel, compact }: ScholarshipDecisionFormProps) {
  const [programId, setProgramId] = React.useState(initial?.programId ?? "");
  const [mode, setMode] = React.useState<Mode>(initial?.amount != null && initial.amount > 0 ? "amount" : programs.length ? "program" : "percentage");
  const [value, setValue] = React.useState(initial?.amount != null && initial.amount > 0 ? String(initial.amount) : "");
  const [remarks, setRemarks] = React.useState(initial?.remarks ?? "");
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const { busy, fieldErrors, run } = useMutation();

  const program = programs.find((p) => p.id === programId);
  const num = Number(value);
  const amount = computeAmount(mode, program, Number.isFinite(num) ? num : 0, originalFee);
  const payable = Math.max(0, originalFee - amount - discountAmount);
  const overflow = amount + discountAmount > originalFee + 0.005;

  const submit = async (status: "APPROVED" | "REJECTED") => {
    if (status === "APPROVED") {
      if (mode !== "program" && (!Number.isFinite(num) || num < 0)) {
        setLocalError(mode === "percentage" ? "Enter a percentage between 0 and 100" : "Enter a valid amount");
        return;
      }
      if (mode === "percentage" && num > 100) {
        setLocalError("Percentage cannot exceed 100");
        return;
      }
      if (mode === "program" && !program) {
        setLocalError("Select a program, or enter a percentage / amount");
        return;
      }
      if (overflow) {
        setLocalError("Scholarship plus discount cannot exceed the original fee");
        return;
      }
    }
    setLocalError(null);
    const body: Record<string, unknown> = { ...extraBody, status, programId: programId || undefined, remarks: remarks.trim() || undefined };
    if (status === "APPROVED") {
      if (mode === "amount") body.scholarshipAmount = num;
      if (mode === "percentage") body.percentage = num;
    }
    const r = await run(() => api.post<{ scholarshipAmount: number; payableFee: number }>(endpoint, body), {
      success: (d) => (status === "APPROVED" ? `Scholarship of ${formatINR(d.scholarshipAmount)} approved` : "Scholarship request rejected"),
      successDescription: (d) => `Payable fee is now ${formatINR(d.payableFee)}. The student has been notified.`,
    });
    if (r !== undefined) {
      setRejectOpen(false);
      onDone?.();
    }
  };

  const modeItems = [
    ...(programs.length ? [{ value: "program", label: "Program default" }] : []),
    { value: "percentage", label: "Percentage" },
    { value: "amount", label: "Fixed amount" },
  ];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit("APPROVED");
      }}
      noValidate
    >
      <Field label="Program" htmlFor="sch-program" error={fieldErrors.programId} hint={program ? `${titleCase(program.type)} · ${program.fixedAmount ? formatINR(program.fixedAmount) : program.percentage ? `${program.percentage}%` : "no default"}${program.maxAmount ? ` · max ${formatINR(program.maxAmount)}` : ""}` : undefined}>
        <Select id="sch-program" value={programId} onChange={(e) => setProgramId(e.target.value)} options={programs.map((p) => ({ value: p.id, label: p.name }))} placeholder={programs.length ? "No program (ad-hoc award)" : "No active programs"} disabled={disabled} />
      </Field>
      <div className="space-y-2">
        <span className="block text-body-sm font-medium text-ink">Scholarship amount</span>
        <SegmentedControl items={modeItems} value={mode} onChange={(v) => setMode(v as Mode)} />
        {mode !== "program" && (
          <Field htmlFor="sch-value" error={localError ?? fieldErrors.scholarshipAmount ?? fieldErrors.percentage}>
            <Input id="sch-value" type="number" inputMode="decimal" min={0} max={mode === "percentage" ? 100 : originalFee} step={mode === "percentage" ? "1" : "1"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "percentage" ? "e.g. 50" : "e.g. 1500"} invalid={!!(localError ?? fieldErrors.scholarshipAmount)} disabled={disabled} aria-label={mode === "percentage" ? "Percentage of the original fee" : "Scholarship amount in rupees"} />
          </Field>
        )}
        {mode === "program" && localError && (
          <p className="text-caption font-medium text-danger" role="alert">
            {localError}
          </p>
        )}
      </div>
      <dl className={`grid gap-2 rounded-md bg-surface p-3 text-body-sm ${compact ? "grid-cols-2" : "grid-cols-3"}`}>
        <div>
          <dt className="text-caption font-medium text-muted uppercase">Original fee</dt>
          <dd className="font-semibold tabular-nums">{formatINR(originalFee)}</dd>
        </div>
        <div>
          <dt className="text-caption font-medium text-muted uppercase">Scholarship</dt>
          <dd className={`font-semibold tabular-nums ${overflow ? "text-danger" : "text-success-dark"}`}>− {formatINR(amount)}</dd>
        </div>
        <div>
          <dt className="text-caption font-medium text-muted uppercase">Payable{discountAmount > 0 ? ` (after ${formatINR(discountAmount)} discount)` : ""}</dt>
          <dd className="font-semibold text-navy tabular-nums">{formatINR(payable)}</dd>
        </div>
      </dl>
      <Field label="Remarks" htmlFor="sch-remarks" error={fieldErrors.remarks} hint="Shared with the student in the decision notification.">
        <Textarea id="sch-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={disabled} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="button" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setRejectOpen(true)} disabled={disabled || busy}>
          Reject request
        </Button>
        <Button type="submit" loading={busy} disabled={disabled} leftIcon={<Award className="h-4 w-4" />}>
          Approve scholarship
        </Button>
      </div>
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject scholarship request"
        description={`The scholarship amount is set to ₹0 and the payable fee returns to ${formatINR(Math.max(0, originalFee - discountAmount))}. The student is notified${remarks.trim() ? " with your remarks" : ""}.`}
        confirmLabel="Reject request"
        danger
        loading={busy}
        onConfirm={() => submit("REJECTED")}
      />
    </form>
  );
}

export interface ExistingAward {
  status: string;
  scholarshipAmount: number;
  payableFee: number;
  programName: string | null;
  remarks: string | null;
  approvedByName: string | null;
  approvedAt: string | Date | null;
}

/** Scholarship card on the application detail page. */
export function ScholarshipPanel({ applicationId, originalFee, discountAmount, programs, award, requested, reason, decidable, canDecide, courseAllows }: { applicationId: string; originalFee: number; discountAmount: number; programs: ScholarshipProgramOption[]; award: ExistingAward | null; requested: boolean; reason: string | null; decidable: boolean; canDecide: boolean; courseAllows: boolean }) {
  const [editing, setEditing] = React.useState(!award);
  const noFee = originalFee <= 0;
  return (
    <div className="space-y-4">
      {requested ? (
        <Alert tone={award ? "info" : "warning"} title="Scholarship requested by the student">
          {reason ? <span className="whitespace-pre-line">{reason}</span> : "No reason was given."}
        </Alert>
      ) : (
        <p className="text-body-sm text-muted">The student did not request a scholarship{courseAllows ? ", but one can still be awarded" : ""}.</p>
      )}
      {award && (
        <dl className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 text-body-sm">
          <div>
            <dt className="text-caption font-medium text-muted uppercase">Decision</dt>
            <dd className={`font-semibold ${award.status === "APPROVED" ? "text-success-dark" : award.status === "REJECTED" ? "text-danger" : "text-amber-700"}`}>{titleCase(award.status)}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-muted uppercase">Amount</dt>
            <dd className="font-semibold tabular-nums">{formatINR(award.scholarshipAmount)}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-muted uppercase">Program</dt>
            <dd>{award.programName ?? "Ad-hoc award"}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-muted uppercase">Decided by</dt>
            <dd>
              {award.approvedByName ?? "—"}
              {award.approvedAt ? <span className="block text-caption text-muted">{new Date(award.approvedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span> : null}
            </dd>
          </div>
          {award.remarks && (
            <div className="col-span-2">
              <dt className="text-caption font-medium text-muted uppercase">Remarks</dt>
              <dd className="whitespace-pre-line text-muted">{award.remarks}</dd>
            </div>
          )}
        </dl>
      )}
      {noFee ? (
        <p className="text-body-sm text-muted">This course has no fee, so no scholarship applies.</p>
      ) : !decidable ? (
        <p className="text-body-sm text-muted">A scholarship decision can no longer be changed for this application (fee fully paid, admitted, or closed).</p>
      ) : !canDecide ? (
        <p className="text-body-sm text-muted">You do not have permission to decide scholarships.</p>
      ) : editing ? (
        <ScholarshipDecisionForm endpoint={`/api/admin/applications/${applicationId}/scholarship`} originalFee={originalFee} discountAmount={discountAmount} programs={programs} initial={award ? { amount: award.scholarshipAmount, remarks: award.remarks } : undefined} onDone={() => setEditing(false)} onCancel={award ? () => setEditing(false) : undefined} compact />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Change decision
        </Button>
      )}
    </div>
  );
}
