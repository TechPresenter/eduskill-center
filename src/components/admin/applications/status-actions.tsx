"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Ban, CheckCircle2, Clock, FileWarning, IndianRupee, Search, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateInputValue, formatINR, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Field } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/admin/pickers/reason-dialog";
import { BatchPicker } from "@/components/admin/pickers/batch-picker";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "ONLINE", label: "Online (gateway)" },
  { value: "OTHER", label: "Other" },
];

export interface StatusActionsProps {
  applicationId: string;
  applicationNo: string;
  status: string;
  allowedTransitions: string[];
  payableAmount: number;
  paidAmount: number;
  currentBatchId: string | null;
  currentBatchLabel: string | null;
  installmentsAllowed: boolean;
  missingDocuments: string[];
  admission: { id: string; admissionNo: string } | null;
  can: { update: boolean; approve: boolean; reject: boolean; confirm: boolean; pay: boolean };
}

type DialogKind = "review" | "documents" | "approve" | "waitlist" | "reject" | "cancel" | "confirm" | "payment" | null;

const PAYABLE = ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED"];
const NO_PERM = "You do not have permission for this action";

/** Workflow buttons for an application, driven by the allowed transitions returned by the server and the viewer's permissions. */
export function StatusActions(p: StatusActionsProps) {
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const close = () => {
    clearErrors();
    setDialog(null);
  };
  const base = `/api/admin/applications/${p.applicationId}`;
  const due = Math.max(0, p.payableAmount - p.paidAmount);
  const allows = (s: string) => p.allowedTransitions.includes(s);
  const terminal = p.allowedTransitions.length === 0;
  const canRecordPayment = PAYABLE.includes(p.status) && due > 0.005;

  const post = (path: string, body: unknown, success: string) => run(() => api.post(`${base}/${path}`, body), { success, error: "Action failed" });

  return (
    <div className="space-y-4">
      {terminal && !p.admission && (
        <Alert tone={p.status === "COMPLETED" ? "success" : "info"} title={`This application is ${titleCase(p.status).toLowerCase()}.`}>
          No further workflow actions are available.
        </Alert>
      )}
      {p.status === "DOCUMENTS_REQUIRED" && p.missingDocuments.length > 0 && (
        <Alert tone="warning" title="Waiting for documents">
          Missing: {p.missingDocuments.join(", ")}. The application returns to review automatically once the student uploads them.
        </Alert>
      )}
      {p.status === "PAYMENT_PENDING" && (
        <Alert tone="warning" title={`${formatINR(due)} due`}>
          The student can pay online or offline from their portal, or staff can record a payment received directly.
        </Alert>
      )}
      {p.status === "PAYMENT_COMPLETED" && !p.admission && (
        <Alert tone="success" title="Fee fully paid">
          {p.currentBatchId ? "Confirm the admission to generate the Student ID and admission number." : "Assign a batch, then confirm the admission."}
        </Alert>
      )}
      {p.admission && (
        <Alert
          tone="success"
          title={`Admission ${p.admission.admissionNo}`}
          action={
            <Link href={`/admin/admissions/${p.admission.id}`} className="self-center text-body-sm font-semibold text-navy hover:underline">
              Open
            </Link>
          }
        >
          Attendance, progress and completion are managed on the admission record.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2 *:w-full [&_button]:w-full lg:flex lg:flex-wrap lg:*:w-auto lg:[&_button]:w-auto">
        {allows("APPROVED") && (
          <Gate allowed={p.can.approve} reason={NO_PERM}>
            <Button size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setDialog("approve")} disabled={busy}>
              Approve
            </Button>
          </Gate>
        )}
        {allows("ADMISSION_CONFIRMED") && (
          <Gate allowed={p.can.confirm} reason={NO_PERM}>
            <Button size="sm" variant="navy" leftIcon={<BadgeCheck className="h-4 w-4" />} onClick={() => setDialog("confirm")} disabled={busy}>
              Confirm admission
            </Button>
          </Gate>
        )}
        {canRecordPayment && (
          <Gate allowed={p.can.pay} reason={NO_PERM}>
            <Button size="sm" variant="secondary" leftIcon={<IndianRupee className="h-4 w-4" />} onClick={() => setDialog("payment")} disabled={busy}>
              Record payment
            </Button>
          </Gate>
        )}
        {allows("UNDER_REVIEW") && (
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button size="sm" variant="outline" leftIcon={<Search className="h-4 w-4" />} onClick={() => setDialog("review")} disabled={busy}>
              {["REJECTED", "WAITLISTED", "DOCUMENTS_REQUIRED"].includes(p.status) ? "Reopen for review" : "Move to review"}
            </Button>
          </Gate>
        )}
        {allows("DOCUMENTS_REQUIRED") && (
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button size="sm" variant="outline" leftIcon={<FileWarning className="h-4 w-4" />} onClick={() => setDialog("documents")} disabled={busy}>
              Request documents
            </Button>
          </Gate>
        )}
        {allows("WAITLISTED") && (
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button size="sm" variant="outline" leftIcon={<Clock className="h-4 w-4" />} onClick={() => setDialog("waitlist")} disabled={busy}>
              Waitlist
            </Button>
          </Gate>
        )}
        {allows("REJECTED") && (
          <Gate allowed={p.can.reject} reason={NO_PERM}>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setDialog("reject")} disabled={busy}>
              Reject
            </Button>
          </Gate>
        )}
        {allows("CANCELLED") && (
          <Gate allowed={p.can.update} reason={NO_PERM}>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<Ban className="h-4 w-4" />} onClick={() => setDialog("cancel")} disabled={busy}>
              Cancel application
            </Button>
          </Gate>
        )}
      </div>

      <ReasonDialog
        open={dialog === "review"}
        onClose={close}
        title="Move to review"
        description={`Application ${p.applicationNo} will be marked Under Review and the student will be notified.`}
        label="Note for the student (optional)"
        minLength={0}
        confirmLabel="Move to review"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await post("review", { note: note || undefined }, "Application moved to review");
          if (r !== undefined) close();
        }}
      />

      <ReasonDialog
        open={dialog === "documents"}
        onClose={close}
        title="Request documents"
        description="Tell the student exactly which documents to upload. The application moves to Documents Required and returns to review automatically once everything is uploaded."
        label="Documents needed"
        placeholder={p.missingDocuments.length ? `e.g. Please upload: ${p.missingDocuments.join(", ")}` : "e.g. Please upload a clear copy of your Aadhaar card."}
        minLength={5}
        confirmLabel="Send request"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await post("request-documents", { note }, "Document request sent");
          if (r !== undefined) close();
        }}
      >
        {p.missingDocuments.length > 0 && (
          <p className="text-caption text-muted">
            Currently missing: <span className="font-semibold text-warning-dark">{p.missingDocuments.join(", ")}</span>
          </p>
        )}
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "waitlist"}
        onClose={close}
        title="Add to waitlist"
        description="The application is placed on the waitlist for this course and center. Any reserved seat is released."
        label="Note for the student (optional)"
        minLength={0}
        confirmLabel="Waitlist"
        loading={busy}
        error={fieldErrors.note}
        onConfirm={async (note) => {
          const r = await post("waitlist", { note: note || undefined }, "Application waitlisted");
          if (r !== undefined) close();
        }}
      />

      <ReasonDialog
        open={dialog === "reject"}
        onClose={close}
        title="Reject application"
        description="The student is notified with this reason. A rejected application can be reopened for review later."
        label="Reason"
        placeholder="e.g. The applicant does not meet the minimum qualification for this course."
        minLength={5}
        confirmLabel="Reject application"
        danger
        loading={busy}
        error={fieldErrors.reason}
        onConfirm={async (reason) => {
          const r = await post("reject", { reason }, "Application rejected");
          if (r !== undefined) close();
        }}
      />

      <ReasonDialog
        open={dialog === "cancel"}
        onClose={close}
        title="Cancel application"
        description="Cancelling is final: the application cannot be reopened and any reserved seat is released."
        label="Reason"
        minLength={3}
        confirmLabel="Cancel application"
        danger
        loading={busy}
        error={fieldErrors.reason}
        onConfirm={async (reason) => {
          const r = await post("cancel", { reason }, "Application cancelled");
          if (r !== undefined) close();
        }}
      />

      {dialog === "approve" && (
        <ApproveDrawer
          applicationId={p.applicationId}
          applicationNo={p.applicationNo}
          currentBatchId={p.currentBatchId}
          due={due}
          busy={busy}
          fieldErrors={fieldErrors}
          onClose={close}
          onSubmit={async (body) => {
            const r = await run(() => api.post<{ status: string }>(`${base}/approve`, body), {
              success: (d) => (d.status === "PAYMENT_PENDING" ? "Approved – fee payment pending" : d.status === "ADMISSION_CONFIRMED" ? "Approved and admission confirmed" : "Application approved"),
              successDescription: (d) =>
                d.status === "PAYMENT_PENDING" ? `The student has been asked to pay ${formatINR(due)}.` : d.status === "ADMISSION_CONFIRMED" ? "Student ID and admission number were generated." : "Allocate a batch to confirm the admission.",
            });
            if (r !== undefined) close();
          }}
        />
      )}

      <ConfirmAdmissionModal
        open={dialog === "confirm"}
        onClose={close}
        applicationNo={p.applicationNo}
        batchLabel={p.currentBatchLabel}
        payableAmount={p.payableAmount}
        paidAmount={p.paidAmount}
        installmentsAllowed={p.installmentsAllowed}
        busy={busy}
        fieldErrors={fieldErrors}
        onSubmit={async (body) => {
          const r = await run(() => api.post<{ admissionNo: string }>(`${base}/confirm`, body), {
            success: (d) => `Admission ${d.admissionNo} confirmed`,
            successDescription: "Student ID and progress record created; the student has been notified.",
          });
          if (r !== undefined) close();
        }}
      />

      {dialog === "payment" && (
        <RecordPaymentDrawer
          due={due}
          busy={busy}
          fieldErrors={fieldErrors}
          onClose={close}
          onSubmit={async (body) => {
            const r = await run(() => api.post<{ paymentNo: string; receiptNo: string | null; applicationStatus: string }>(`${base}/payments`, body), {
              success: (d) => `Payment ${d.paymentNo} recorded`,
              successDescription: (d) => `${d.receiptNo ? `Receipt ${d.receiptNo} issued. ` : ""}Application is now ${titleCase(d.applicationStatus)}.`,
            });
            if (r !== undefined) close();
          }}
        />
      )}
    </div>
  );
}

function ApproveDrawer({
  applicationId,
  applicationNo,
  currentBatchId,
  due,
  busy,
  fieldErrors,
  onClose,
  onSubmit,
}: {
  applicationId: string;
  applicationNo: string;
  currentBatchId: string | null;
  due: number;
  busy: boolean;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (body: { batchId: string | null; note?: string }) => Promise<void>;
}) {
  const [batchId, setBatchId] = React.useState<string | null>(currentBatchId);
  const [note, setNote] = React.useState("");
  const outcome = due > 0.005 ? "PAYMENT_PENDING" : batchId ? "ADMISSION_CONFIRMED" : "APPROVED";
  return (
    <ResponsiveSheet open onClose={onClose} title="Approve application" description={`${applicationNo} – choose the batch the student will join.`} className="max-w-xl" size="lg">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({ batchId, note: note.trim() || undefined });
        }}
        noValidate
      >
        <Field label="Batch" hint="Approving reserves a seat in the selected batch. Full batches cannot be chosen." error={fieldErrors.batchId}>
          <BatchPicker endpoint={`/api/admin/applications/${applicationId}/batch`} value={batchId} onChange={(id) => setBatchId(id)} allowNone currentBatchId={currentBatchId} />
        </Field>
        <Field label="Note (optional)" htmlFor="approve-note" error={fieldErrors.note}>
          <Textarea id="approve-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible in the status history and sent to the student." />
        </Field>
        <Alert tone={outcome === "ADMISSION_CONFIRMED" ? "success" : "info"} title={`Result: ${titleCase(outcome)}`}>
          {outcome === "PAYMENT_PENDING" && (
            <>
              A fee of <strong>{formatINR(due)}</strong> is due. The student will be asked to pay; the admission is confirmed once the full fee is received (automatically when enabled in settings) or when staff confirm it.
            </>
          )}
          {outcome === "ADMISSION_CONFIRMED" && <>No fee is due, so the admission is confirmed immediately: a Student ID and admission number are generated and the student is notified.</>}
          {outcome === "APPROVED" && <>No fee is due but no batch is selected yet. Allocate a batch later and then confirm the admission.</>}
        </Alert>
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
            Approve
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}

function ConfirmAdmissionModal({
  open,
  onClose,
  applicationNo,
  batchLabel,
  payableAmount,
  paidAmount,
  installmentsAllowed,
  busy,
  fieldErrors,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  applicationNo: string;
  batchLabel: string | null;
  payableAmount: number;
  paidAmount: number;
  installmentsAllowed: boolean;
  busy: boolean;
  fieldErrors: Record<string, string>;
  onSubmit: (body: { note?: string; allowPartialPayment?: boolean }) => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [partial, setPartial] = React.useState(false);
  const due = Math.max(0, payableAmount - paidAmount);
  const hasDue = due > 0.005;
  const blocked = !batchLabel || (hasDue && paidAmount <= 0);
  const needsPartial = hasDue && paidAmount > 0;
  const canSubmit = !blocked && (!needsPartial || partial);
  return (
    <Modal open={open} onClose={onClose} title="Confirm admission" description={`${applicationNo} – generates the Student ID (if missing), admission number and progress record.`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          void onSubmit({ note: note.trim() || undefined, allowPartialPayment: needsPartial ? partial : undefined });
        }}
        noValidate
      >
        <dl className="grid grid-cols-2 gap-3 rounded-md bg-surface p-3 text-body-sm">
          <div>
            <dt className="text-caption font-medium text-muted uppercase">Batch</dt>
            <dd className="font-semibold text-ink">{batchLabel ?? <span className="text-danger">Not assigned</span>}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-muted uppercase">Fee</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {formatINR(paidAmount)} paid of {formatINR(payableAmount)}
              {hasDue && (
                <Badge tone="warning" className="ml-2">
                  Due {formatINR(due)}
                </Badge>
              )}
            </dd>
          </div>
        </dl>
        {!batchLabel && (
          <Alert tone="danger" title="Assign a batch first">
            Admission cannot be confirmed without a batch. Use “Change batch” on the course card.
          </Alert>
        )}
        {batchLabel && hasDue && paidAmount <= 0 && (
          <Alert tone="danger" title={`${formatINR(due)} still due`}>
            No payment has been received. Record or verify a payment before confirming the admission.
          </Alert>
        )}
        {needsPartial && (
          <Checkbox
            checked={partial}
            onChange={(e) => setPartial(e.target.checked)}
            label={`Confirm with partial payment (${formatINR(due)} still due)`}
            description={installmentsAllowed ? "Installments are allowed on this application; the balance can be collected later." : "Installments are not enabled for this application – tick only if the Foundation has agreed to collect the balance later."}
          />
        )}
        <Field label="Note (optional)" htmlFor="confirm-note" error={fieldErrors.note}>
          <Textarea id="confirm-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="navy" loading={busy} disabled={!canSubmit} leftIcon={<BadgeCheck className="h-4 w-4" />}>
            Confirm admission
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function RecordPaymentDrawer({
  due,
  busy,
  fieldErrors,
  onClose,
  onSubmit,
}: {
  due: number;
  busy: boolean;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (body: { amount: number; method: string; referenceNo?: string; paidAt?: string; description?: string }) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(String(due));
  const [method, setMethod] = React.useState("CASH");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(dateInputValue(new Date()));
  const [description, setDescription] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const n = Number(amount);
  const partial = Number.isFinite(n) && n > 0 && n < due - 0.005;
  return (
    <ResponsiveSheet open onClose={onClose} title="Record payment" description="For money received directly – cash at the center, bank transfer seen on the statement, or a cheque. A receipt is issued immediately.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!Number.isFinite(n) || n <= 0) {
            setLocalError("Enter the amount received");
            return;
          }
          if (n > due + 0.005) {
            setLocalError(`Amount cannot exceed the due amount of ${formatINR(due)}`);
            return;
          }
          setLocalError(null);
          void onSubmit({ amount: n, method, referenceNo: referenceNo.trim() || undefined, paidAt: paidAt || undefined, description: description.trim() || undefined });
        }}
        noValidate
      >
        <Field label="Amount received" htmlFor="pay-amount" required hint={`Due: ${formatINR(due)}`} error={localError ?? fieldErrors.amount}>
          <Input id="pay-amount" type="number" inputMode="decimal" min={1} max={due} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!(localError ?? fieldErrors.amount)} leftIcon={<IndianRupee className="h-4 w-4" />} />
        </Field>
        {partial && <Alert tone="warning">This is a partial payment. The application stays in Payment Pending until the balance of {formatINR(due - n)} is received.</Alert>}
        <Field label="Method" htmlFor="pay-method" required error={fieldErrors.method}>
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />
        </Field>
        <Field label="Reference / transaction no." htmlFor="pay-ref" error={fieldErrors.referenceNo} hint="UPI ID, UTR, cheque number or receipt book number.">
          <Input id="pay-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </Field>
        <Field label="Date received" htmlFor="pay-date" error={fieldErrors.paidAt}>
          <Input id="pay-date" type="date" value={paidAt} max={dateInputValue(new Date())} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="Description (optional)" htmlFor="pay-desc" error={fieldErrors.description}>
          <Input id="pay-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown on the receipt" />
        </Field>
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} leftIcon={<IndianRupee className="h-4 w-4" />}>
            Record payment
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
