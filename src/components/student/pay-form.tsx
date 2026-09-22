"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/form";
import { Input, RadioCards, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatINR, titleCase } from "@/lib/utils";
import { PaymentSuccess, type PaymentResult } from "@/components/student/mobile/payment-success";

export interface PaymentSummary {
  applicationId: string;
  applicationNo: string;
  course: string;
  originalFee: number;
  scholarshipAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  due: number;
  installmentsAllowed: boolean;
  gateway: "manual" | "razorpay";
  allowOffline: boolean;
  bankDetails: string;
  razorpayKeyId: string | null;
  pendingPayment: { id: string; paymentNo: string; amount: number; status: string; method: string } | null;
}

interface InitiateResult {
  payment: { id: string; paymentNo: string; status: string; amount: number; receiptNo?: string | null };
  checkout: { gateway: string; keyId: string | null; orderId: string | null; amount: number; currency: string; name: string; email: string | null; contact: string | null } | null;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (r: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const OFFLINE_METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer / NEFT / IMPS" },
  { value: "CASH", label: "Cash at the training center" },
  { value: "CHEQUE", label: "Cheque / DD" },
];

const OFFLINE_FORM_ID = "offline-payment-form";

export function PayForm({ summary, contact }: { summary: PaymentSummary; contact: { email: string; phone: string } }) {
  const router = useRouter();
  const online = summary.gateway === "razorpay";
  const offline = summary.allowOffline;
  const [mode, setMode] = React.useState<"ONLINE" | "OFFLINE">(online ? "ONLINE" : "OFFLINE");
  const [amount, setAmount] = React.useState(String(summary.due));
  const [method, setMethod] = React.useState("UPI");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [proof, setProof] = React.useState<UploadedFile | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState<PaymentResult | null>(null);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 1 && amountNum <= summary.due + 0.005;
  const payNow = amountValid ? amountNum : summary.due;

  const payOnline = async () => {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) throw new Error("Could not load the payment gateway. Please check your connection and try again.");
      const res = await api.post<InitiateResult>("/api/student/payments/initiate", { applicationId: summary.applicationId, amount: summary.installmentsAllowed ? amountNum : undefined, method: "ONLINE" });
      if (!res.checkout?.orderId) throw new Error("Payment order could not be created.");
      const checkout = res.checkout;
      const rzp = new window.Razorpay({
        key: checkout.keyId ?? summary.razorpayKeyId,
        amount: Math.round(checkout.amount * 100),
        currency: checkout.currency,
        name: "Fee payment",
        description: `${summary.course} · ${summary.applicationNo}`,
        order_id: checkout.orderId,
        prefill: { name: checkout.name, email: checkout.email ?? undefined, contact: checkout.contact ?? undefined },
        notes: { applicationNo: summary.applicationNo },
        theme: { color: "#12357a" },
        handler: async (r: RazorpayResponse) => {
          try {
            const v = await api.post<{ id: string; paymentNo: string; receiptNo: string | null; status: string; amount: number }>("/api/student/payments/verify", {
              paymentId: res.payment.id,
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            toast.success("Payment successful", `Payment ${v.paymentNo} received.`);
            setDone({ id: v.id, paymentNo: v.paymentNo, receiptNo: v.receiptNo, status: v.status, amount: v.amount, paidAt: new Date().toISOString(), method: "ONLINE" });
            router.refresh();
          } catch (err) {
            setError(errorMessage(err, "Payment verification failed."));
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            toast.error("Payment cancelled", "Nothing was charged. You can try again when you are ready.");
          },
        },
      });
      rzp.on("payment.failed", (r) => {
        setError(r.error?.description ?? "Payment failed. Please try again.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fieldErrors);
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const payOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await api.post<InitiateResult>("/api/student/payments/initiate", {
        applicationId: summary.applicationId,
        amount: summary.installmentsAllowed ? amountNum : undefined,
        method,
        referenceNo: referenceNo || null,
        notes: notes || null,
        proofUrl: proof?.url ?? null,
        proofName: proof?.name ?? null,
      });
      toast.success("Payment declared", "The Foundation will verify it and issue your receipt.");
      setDone({
        id: res.payment.id,
        paymentNo: res.payment.paymentNo,
        receiptNo: res.payment.receiptNo ?? null,
        status: res.payment.status,
        amount: res.payment.amount,
        paidAt: res.payment.status === "COMPLETED" ? new Date().toISOString() : null,
        method,
      });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <PaymentSuccess payment={done} applicationId={summary.applicationId} applicationNo={summary.applicationNo} course={summary.course} />;
  }

  const canPay = online || offline;
  const payingOnline = mode === "ONLINE" && online;

  return (
    <>
      {/* Phones: fee breakdown first, then the payment form. Desktop (lg+): unchanged 3-column grid. */}
      <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {summary.pendingPayment && (
            <Alert tone="info" title={`Payment ${summary.pendingPayment.paymentNo} is ${titleCase(summary.pendingPayment.status)}`}>
              {summary.pendingPayment.status === "PROCESSING"
                ? `Your ${titleCase(summary.pendingPayment.method)} payment of ${formatINR(summary.pendingPayment.amount)} is awaiting verification by the Foundation. You do not need to pay again unless asked.`
                : `An online payment of ${formatINR(summary.pendingPayment.amount)} was started but not completed. Starting a new payment replaces it.`}{" "}
              <Link href={`/api/student/payments/${summary.pendingPayment.id}/receipt`} target="_blank" className="inline-flex min-h-11 items-center font-semibold underline">
                View invoice
              </Link>
            </Alert>
          )}

          {!canPay ? (
            <Alert tone="warning" title="Online payments are not available right now">
              Please contact the Foundation to pay your fee: {contact.phone} · {contact.email}. Your seat remains reserved.
            </Alert>
          ) : (
            <Card>
              <CardHeader title="Choose how to pay" />
              <CardBody className="space-y-5">
                {online && offline && (
                  <RadioCards
                    name="mode"
                    value={mode}
                    onChange={(v) => setMode(v as "ONLINE" | "OFFLINE")}
                    columns={2}
                    size="lg"
                    options={[
                      { value: "ONLINE", label: "Pay online", description: "UPI, cards, net banking via secure gateway", icon: <CreditCard className="h-5 w-5" /> },
                      { value: "OFFLINE", label: "Pay offline", description: "Cash, UPI or bank transfer – verified by the Foundation", icon: <Banknote className="h-5 w-5" /> },
                    ]}
                  />
                )}

                <Field label="Amount" htmlFor="amount" required error={errors.amount} hint={summary.installmentsAllowed ? `Installments are allowed. Pay any amount between ₹1 and ${formatINR(summary.due)}.` : `Full due amount of ${formatINR(summary.due)} is payable.`}>
                  <Input id="amount" type="number" min={1} max={summary.due} step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!summary.installmentsAllowed} invalid={!!errors.amount || !amountValid} />
                </Field>

                {error && <Alert tone="danger">{error}</Alert>}

                {payingOnline ? (
                  <p className="flex items-start gap-2 text-body-sm text-muted">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Payments are processed securely by Razorpay. Your receipt is generated instantly.
                  </p>
                ) : (
                  <form id={OFFLINE_FORM_ID} onSubmit={payOffline} className="space-y-4" noValidate>
                    {summary.bankDetails ? (
                      <div className="rounded-md border border-line bg-surface p-4">
                        <p className="mb-1 flex items-center gap-2 text-body-sm font-semibold text-navy">
                          <Banknote className="h-4 w-4" /> Bank / UPI details
                        </p>
                        <pre className="font-sans text-body-sm break-words whitespace-pre-wrap text-ink">{summary.bankDetails}</pre>
                      </div>
                    ) : (
                      <Alert tone="info">Pay at your training center or ask the Foundation for bank details ({contact.phone}), then record the payment here.</Alert>
                    )}
                    <Field label="Payment method" htmlFor="method" required error={errors.method}>
                      <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)} options={OFFLINE_METHODS} />
                    </Field>
                    <Field label={method === "CASH" ? "Receipt / reference number (optional)" : "Transaction / reference number"} htmlFor="referenceNo" required={method !== "CASH"} error={errors.referenceNo} hint="UTR number for bank transfer, UPI transaction ID, or cheque number.">
                      <Input id="referenceNo" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} invalid={!!errors.referenceNo} />
                    </Field>
                    <Field label="Proof of payment (optional)" hint="Screenshot or photo of the receipt. PDF / JPG / PNG up to 5 MB.">
                      <FileUpload endpoint="/api/student/uploads?kind=payment-proof" accept=".jpg,.jpeg,.png,.webp,.pdf" maxSizeMb={5} value={proof} onChange={setProof} sources={["camera", "gallery", "files"]} capture="environment" label="Upload proof" />
                    </Field>
                    <Field label="Notes (optional)" htmlFor="notes" error={errors.notes}>
                      <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Paid at Kolkata center on 12 Sep" />
                    </Field>
                    <p className="text-caption text-muted">After submission the payment shows as “Processing” until the Foundation verifies it. Your receipt is issued on verification.</p>
                  </form>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader title="Fee summary" />
          <CardBody className="divide-y divide-line py-1">
            <Row label="Course fee" value={formatINR(summary.originalFee)} />
            {summary.scholarshipAmount > 0 && <Row label="Scholarship" value={`− ${formatINR(summary.scholarshipAmount)}`} tone="success" />}
            {summary.discountAmount > 0 && <Row label="Discount" value={`− ${formatINR(summary.discountAmount)}`} tone="success" />}
            <Row label="Payable" value={formatINR(summary.payableAmount)} strong />
            {summary.paidAmount > 0 && <Row label="Paid so far" value={formatINR(summary.paidAmount)} tone="success" />}
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-body font-semibold text-ink">Due now</span>
              <span className="text-h2 text-orange tabular-nums">{formatINR(summary.due)}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {canPay && (
        <StickyActionBar>
          {payingOnline ? (
            <Button size="lg" fullWidth onClick={() => void payOnline()} loading={busy} disabled={!amountValid} leftIcon={<CreditCard className="h-5 w-5" />} className="lg:w-auto">
              Proceed to Payment · {formatINR(payNow)}
            </Button>
          ) : (
            <Button type="submit" form={OFFLINE_FORM_ID} size="lg" fullWidth loading={busy} disabled={!amountValid} className="lg:w-auto">
              Submit payment details · {formatINR(payNow)}
            </Button>
          )}
        </StickyActionBar>
      )}
    </>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 text-body ${strong ? "font-semibold text-ink" : tone === "success" ? "text-green-700" : "text-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
