"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, HandHeart, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";
import { cn, formatINR } from "@/lib/utils";
import type { CreateDonationResult } from "@/server/donations";

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (r: { error?: { description?: string } }) => void) => void;
}
type RazorpayCtor = new (opts: Record<string, unknown>) => RazorpayInstance;

function loadRazorpay(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => reject(new Error("Razorpay failed to load"));
    document.body.appendChild(s);
  });
}

const empty = { donorName: "", email: "", mobile: "", amount: "1000", campaignId: "", message: "", pan: "", website: "" };

export function DonationForm({ campaigns, gateway, bankDetails, initialCampaignId, initialAmount }: { campaigns: { id: string; title: string }[]; gateway: "manual" | "razorpay"; bankDetails: string | null; initialCampaignId?: string; initialAmount?: string }) {
  const startAmount = initialAmount && /^\d+$/.test(initialAmount) && Number(initialAmount) >= 100 ? String(Number(initialAmount)) : empty.amount;
  const [form, setForm] = React.useState({ ...empty, amount: startAmount, campaignId: initialCampaignId && campaigns.some((c) => c.id === initialCampaignId) ? initialCampaignId : "" });
  const [anonymous, setAnonymous] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ kind: "manual" | "paid" | "pending-verify"; donationNo: string; amount: number; bankDetails: string | null; campaignTitle: string | null } | null>(null);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await api.post<CreateDonationResult>("/api/public/donations", { ...form, amount: Number(form.amount), isAnonymous: anonymous });
      if (res.gateway === "manual" || !res.checkout) {
        setResult({ kind: "manual", donationNo: res.donation.donationNo, amount: res.donation.amount, bankDetails: res.bankDetails, campaignTitle: res.donation.campaignTitle });
        setBusy(false);
        return;
      }
      const Razorpay = await loadRazorpay();
      const checkout = res.checkout;
      const rzp = new Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        order_id: checkout.orderId,
        prefill: checkout.prefill,
        notes: checkout.notes,
        theme: { color: "#12357A" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r: RazorpayResponse) => {
          try {
            await api.post(`/api/public/donations/${res.donation.id}/verify`, r);
            setResult({ kind: "paid", donationNo: res.donation.donationNo, amount: res.donation.amount, bankDetails: null, campaignTitle: res.donation.campaignTitle });
          } catch (err) {
            setResult({ kind: "pending-verify", donationNo: res.donation.donationNo, amount: res.donation.amount, bankDetails: null, campaignTitle: res.donation.campaignTitle });
            setError(err instanceof ApiClientError ? err.message : "We could not confirm the payment automatically.");
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.on("payment.failed", (r) => {
        setError(r.error?.description || "Payment failed. You have not been charged.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.status === 422 ? null : err.message);
      } else setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (result) {
    const paid = result.kind === "paid";
    return (
      <div className={cn("rounded-card-lg p-6 sm:p-8", paid ? "bg-success-light" : "bg-lavender")} role="status">
        <div className="flex items-start gap-4">
          {paid ? <CheckCircle2 className="h-10 w-10 shrink-0 text-success" aria-hidden /> : <Clock className="h-10 w-10 shrink-0 text-navy" aria-hidden />}
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-navy">{paid ? "Thank you for your donation!" : result.kind === "manual" ? "Almost there – complete your transfer" : "Payment received, confirmation pending"}</h3>
            <p className="mt-1 text-sm text-muted">
              Donation number <span className="font-semibold text-navy">{result.donationNo}</span> · {formatINR(result.amount)}
              {result.campaignTitle ? ` · ${result.campaignTitle}` : ""}
            </p>
          </div>
        </div>
        {result.kind === "manual" && (
          <div className="mt-6 space-y-3 text-sm">
            <p className="text-ink">Your donation is recorded as <strong>pending</strong>. Please transfer {formatINR(result.amount)} using the details below and quote your donation number as the payment reference. Our team will confirm it and issue your receipt.</p>
            {result.bankDetails ? (
              <pre className="rounded-xl bg-white p-4 font-sans whitespace-pre-wrap text-ink shadow-card">{result.bankDetails}</pre>
            ) : (
              <Alert tone="info">Bank details will be shared by our team. Please <Link href="/contact" className="font-semibold underline">contact us</Link> quoting your donation number.</Alert>
            )}
          </div>
        )}
        {result.kind === "pending-verify" && (
          <Alert tone="warning" className="mt-6">
            {error ?? "We could not confirm the payment automatically."} Please keep your donation number – our team will reconcile it with the payment gateway and email your receipt.
          </Alert>
        )}
        {paid && <p className="mt-6 text-sm text-ink">A receipt will be sent to the email address you provided. Your support funds scholarships, training materials and local center operations.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label="Donation form">
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-ink">Choose an amount</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {QUICK_AMOUNTS.map((a) => {
            const active = form.amount === String(a);
            return (
              <button key={a} type="button" onClick={() => setForm((f) => ({ ...f, amount: String(a) }))} aria-pressed={active} className={cn("h-11 rounded-xl border text-sm font-bold transition-colors", active ? "border-orange bg-orange text-white" : "border-line bg-white text-navy hover:border-orange hover:text-orange")}>
                {formatINR(a)}
              </button>
            );
          })}
        </div>
        <Field label="Or enter an amount (₹)" htmlFor="don-amount" className="mt-3" error={errors.amount} hint="Minimum ₹100">
          <Input id="don-amount" type="number" min={100} step={1} inputMode="numeric" value={form.amount} onChange={set("amount")} leftIcon={<IndianRupee className="h-4 w-4" />} invalid={!!errors.amount} required />
        </Field>
      </fieldset>
      <FormGrid>
        <Field label="Your name" htmlFor="don-name" required error={errors.donorName}>
          <Input id="don-name" value={form.donorName} onChange={set("donorName")} autoComplete="name" required invalid={!!errors.donorName} />
        </Field>
        <Field label="Email (for receipt)" htmlFor="don-email" error={errors.email}>
          <Input id="don-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" invalid={!!errors.email} />
        </Field>
        <Field label="Mobile" htmlFor="don-mobile" error={errors.mobile}>
          <Input id="don-mobile" type="tel" inputMode="numeric" value={form.mobile} onChange={set("mobile")} autoComplete="tel" invalid={!!errors.mobile} />
        </Field>
        <Field label="PAN (optional, for tax receipt)" htmlFor="don-pan" error={errors.pan}>
          <Input id="don-pan" value={form.pan} onChange={set("pan")} maxLength={10} className="uppercase" invalid={!!errors.pan} />
        </Field>
        {campaigns.length > 0 && (
          <Field label="Support a campaign" htmlFor="don-campaign" error={errors.campaignId} className="sm:col-span-2">
            <Select id="don-campaign" value={form.campaignId} onChange={set("campaignId")} options={campaigns.map((c) => ({ value: c.id, label: c.title }))} placeholder="General fund (where it is needed most)" />
          </Field>
        )}
      </FormGrid>
      <Field label="Message (optional)" htmlFor="don-message" error={errors.message}>
        <Textarea id="don-message" rows={3} value={form.message} onChange={set("message")} maxLength={1000} />
      </Field>
      <Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} label="Keep my donation anonymous" description="Your name will not be shown publicly." />
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="don-website">Website</label>
        <input id="don-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <Button type="submit" size="lg" loading={busy} leftIcon={<HandHeart className="h-5 w-5" />}>
        {gateway === "razorpay" ? `Donate ${form.amount ? formatINR(Number(form.amount)) : ""} securely` : "Continue to bank transfer"}
      </Button>
      {gateway === "manual" && <p className="text-xs text-muted">Online payments are not enabled yet. You will receive bank transfer instructions and a donation number after this step.{bankDetails ? "" : " Our team will share the account details with you."}</p>}
    </form>
  );
}
