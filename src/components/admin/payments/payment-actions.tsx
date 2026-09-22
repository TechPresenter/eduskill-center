"use client";

import * as React from "react";
import { CheckCircle2, FileText, RotateCcw, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn, formatINR, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { ReasonDialog } from "@/components/admin/pickers/reason-dialog";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";
import { PAYMENT_METHODS } from "@/components/admin/applications/status-actions";

export interface PaymentActionsProps {
  paymentId: string;
  paymentNo: string;
  status: string;
  method: string;
  amount: number;
  referenceNo: string | null;
  studentName: string;
  proofUrl?: string | null;
  can: { verify: boolean; refund: boolean };
  /** Row usage: icon-sized buttons. */
  compact?: boolean;
}

type DialogKind = "verify" | "reject" | "refund" | null;
const NO_PERM = "You do not have permission for this action";

/** Verify / reject / refund / document controls for a payment. */
export function PaymentActions(p: PaymentActionsProps) {
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [method, setMethod] = React.useState(p.method);
  const [reference, setReference] = React.useState(p.referenceNo ?? "");
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const base = `/api/admin/payments/${p.paymentId}`;
  const pending = p.status === "PENDING" || p.status === "PROCESSING";
  const size = p.compact ? "xs" : "sm";
  // Row actions stay icon-compact on desktop but reach the 44px touch target inside the mobile card footer.
  const touch = p.compact ? "max-md:h-11 max-md:px-4 max-md:text-body-sm" : undefined;
  const close = () => {
    clearErrors();
    setDialog(null);
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 md:gap-1.5">
      <a href={`${base}/document`} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 rounded-md border border-line bg-white font-semibold text-ink hover:bg-surface ${p.compact ? "h-11 px-4 text-body-sm md:h-8 md:px-2.5 md:text-caption" : "h-11 px-4 text-body-sm md:h-9 md:px-3.5"}`} aria-label={`Open ${p.status === "COMPLETED" ? "receipt" : "invoice"} for ${p.paymentNo}`}>
        <FileText className="h-3.5 w-3.5" /> {p.status === "COMPLETED" ? "Receipt" : "Invoice"}
      </a>
      {pending && (
        <>
          <Gate allowed={p.can.verify} reason={NO_PERM}>
            <Button
              size={size}
              className={touch}
              variant="secondary"
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={() => {
                setMethod(p.method);
                setReference(p.referenceNo ?? "");
                setDialog("verify");
              }}
            >
              Verify
            </Button>
          </Gate>
          <Gate allowed={p.can.verify} reason={NO_PERM}>
            <Button size={size} variant="ghost" className={cn("text-danger hover:bg-danger-light", touch)} leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setDialog("reject")}>
              Reject
            </Button>
          </Gate>
        </>
      )}
      {p.status === "COMPLETED" && (
        <Gate allowed={p.can.refund} reason={NO_PERM}>
          <Button size={size} variant="ghost" className={cn("text-danger hover:bg-danger-light", touch)} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setDialog("refund")}>
            Refund
          </Button>
        </Gate>
      )}

      <Modal open={dialog === "verify"} onClose={close} title="Verify payment" description={`${p.paymentNo} · ${formatINR(p.amount)} from ${p.studentName}. A receipt is issued and, when the fee is fully paid and a batch is assigned, the admission may be confirmed automatically.`} size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => api.post<{ receiptNo: string | null; applicationStatus: string }>(`${base}/verify`, { method, referenceNo: reference.trim() || undefined }), {
              success: (d) => `Payment verified${d.receiptNo ? ` – receipt ${d.receiptNo}` : ""}`,
              successDescription: (d) => `Application is now ${titleCase(d.applicationStatus)}.`,
            });
            if (r !== undefined) close();
          }}
          noValidate
        >
          {p.proofUrl && (
            <Alert tone="info">
              The student attached proof:{" "}
              <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                open file
              </a>
            </Alert>
          )}
          <Field label="Method" htmlFor="ver-method" error={fieldErrors.method}>
            <Select id="ver-method" value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />
          </Field>
          <Field label="Reference / UTR" htmlFor="ver-ref" error={fieldErrors.referenceNo} hint="As seen on the bank statement or UPI app.">
            <Input id="ver-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
              Mark as received
            </Button>
          </div>
        </form>
      </Modal>

      <ReasonDialog
        open={dialog === "reject"}
        onClose={close}
        title="Reject payment"
        description={`${p.paymentNo} is marked Failed and the student is told why. They can submit a new payment.`}
        label="Reason"
        placeholder="e.g. No matching credit found on the bank statement."
        minLength={3}
        confirmLabel="Reject payment"
        danger
        loading={busy}
        error={fieldErrors.reason}
        onConfirm={async (reason) => {
          const r = await run(() => api.post(`${base}/reject`, { reason }), { success: "Payment rejected" });
          if (r !== undefined) close();
        }}
      />
      <ReasonDialog
        open={dialog === "refund"}
        onClose={close}
        title="Refund payment"
        description={`${formatINR(p.amount)} is marked refunded and deducted from the application's paid amount. Record the actual bank refund separately.`}
        label="Reason"
        minLength={3}
        confirmLabel="Mark refunded"
        danger
        loading={busy}
        error={fieldErrors.reason}
        onConfirm={async (reason) => {
          const r = await run(() => api.post(`${base}/refund`, { reason }), { success: "Payment refunded" });
          if (r !== undefined) close();
        }}
      />
    </div>
  );
}
