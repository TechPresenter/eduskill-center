import * as React from "react";
import { CheckCircle2, Clock, Download, FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { formatDateTime, formatINR, titleCase } from "@/lib/utils";

export interface PaymentResult {
  /** Payment row id (used for the receipt / proforma invoice download). */
  id: string;
  paymentNo: string;
  receiptNo?: string | null;
  status: string;
  amount: number;
  /** ISO timestamp; falsy while an offline payment is still awaiting verification. */
  paidAt?: string | null;
  method: string;
}

/**
 * Full-card confirmation shown after a payment: big status icon, the amount, Payment ID / Receipt /
 * Date / Method / Status and two full-width 48px actions (receipt download + back to the application).
 * Server-safe – every prop is serialisable.
 */
export function PaymentSuccess({ payment, applicationId, applicationNo, course }: { payment: PaymentResult; applicationId: string; applicationNo?: string; course?: string }) {
  const completed = payment.status === "COMPLETED";
  return (
    <Card className="mx-auto max-w-xl">
      <CardBody className="space-y-5 py-6 text-center">
        <div className="flex justify-center">
          <span className={completed ? "flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success" : "flex h-16 w-16 items-center justify-center rounded-full bg-warning-light text-orange"} aria-hidden>
            {completed ? <CheckCircle2 className="h-9 w-9" /> : <Clock className="h-9 w-9" />}
          </span>
        </div>
        <div>
          <h2 className="font-heading text-xl font-extrabold text-navy">{completed ? "Payment successful" : "Payment recorded"}</h2>
          <p className="mt-1 text-sm text-muted">
            {completed
              ? `Your fee has been received${course ? ` for ${course}` : ""}. The receipt is available below.`
              : "The Foundation will verify your payment and issue the receipt – this usually takes 1–2 working days."}
          </p>
        </div>
        <p className="text-3xl font-extrabold text-orange tabular-nums">{formatINR(payment.amount)}</p>

        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface/60 p-4 text-left">
          <KeyValue label="Payment ID" value={<span className="font-mono">{payment.paymentNo}</span>} />
          <KeyValue label="Receipt no." value={payment.receiptNo ? <span className="font-mono">{payment.receiptNo}</span> : "On verification"} />
          <KeyValue label="Date" value={payment.paidAt ? formatDateTime(payment.paidAt) : "—"} />
          <KeyValue label="Method" value={titleCase(payment.method.replace(/_/g, " "))} />
          <KeyValue label="Status" value={<StatusBadge status={payment.status} />} />
          {applicationNo && <KeyValue label="Application" value={<span className="font-mono">{applicationNo}</span>} />}
        </dl>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href={`/api/student/payments/${payment.id}/receipt`} target="_blank" size="lg" variant="navy" fullWidth className="sm:w-auto" leftIcon={completed ? <Download className="h-5 w-5" /> : <FileText className="h-5 w-5" />}>
            {completed ? "Download receipt" : "Proforma invoice"}
          </ButtonLink>
          <ButtonLink href={`/student/applications/${applicationId}`} size="lg" variant="outline" fullWidth className="sm:w-auto">
            Back to application
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}
