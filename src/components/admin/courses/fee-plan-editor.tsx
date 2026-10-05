"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox, RadioCards } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import type { CourseFeeType } from "@/generated/prisma/enums";
import { feeDisplayFromCourse, formatCourseFee, type FeePlanLike, type OfferPricing } from "@/lib/course-pricing";
import type { CourseFeePlanDto } from "@/server/course-cms";
import { FeePreview } from "@/components/admin/courses/fee-preview";

/**
 * The fee plan editor. The preview beside the form is `formatCourseFee()` applied to the values
 * currently in the inputs, so what the Foundation reads here is literally the string the public
 * page will print — there is no second formatter in this file.
 *
 * `CourseFeePlan` decides how a price is *presented*. The transactional columns
 * (`Course.courseFee`, `registrationFee`, `examFee`, `certificateFee`) still decide what a student
 * is billed, and this screen never touches them.
 */

interface FeeForm {
  feeType: CourseFeeType;
  currency: string;
  baseFee: string;
  discountedFee: string;
  offerPrice: string;
  enrolmentFee: string;
  paymentRequired: boolean;
  customLabel: string;
  note: string;
}

const FEE_TYPE_OPTIONS = [
  { value: "FREE", label: "No fee", description: "Nothing payable. If the course record bills a fee, the site shows that instead." },
  { value: "ONE_TIME", label: "One time", description: "A single course fee." },
  { value: "MONTHLY", label: "Monthly", description: "The amount is charged per month." },
  { value: "CUSTOM", label: "Custom", description: "No number — your own label is shown instead." },
];

const money = (v: number | null | undefined) => (v == null ? "" : String(v));

const toForm = (plan: CourseFeePlanDto | null, fallback: FeePlanLike): FeeForm =>
  plan
    ? {
        feeType: plan.feeType,
        currency: plan.currency,
        baseFee: money(plan.baseFee),
        discountedFee: money(plan.discountedFee),
        offerPrice: money(plan.offerPrice),
        enrolmentFee: money(plan.enrolmentFee),
        paymentRequired: plan.paymentRequired,
        customLabel: plan.customLabel ?? "",
        note: plan.note ?? "",
      }
    : {
        // No plan row yet: start from what the site already shows for this course, so saving
        // without edits is a no-op rather than a surprise price change.
        feeType: fallback.feeType,
        currency: (fallback.currency ?? "INR").toUpperCase(),
        baseFee: money(fallback.baseFee),
        discountedFee: "",
        offerPrice: "",
        enrolmentFee: money(fallback.enrolmentFee ?? 0),
        paymentRequired: fallback.paymentRequired ?? true,
        customLabel: "",
        note: "",
      };

/** The form as the pricing helper wants it: blank means "not set", never zero. */
function planFromForm(f: FeeForm): FeePlanLike {
  const n = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const parsed = Number(t);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    feeType: f.feeType,
    currency: f.currency.trim().toUpperCase() || "INR",
    baseFee: f.feeType === "FREE" ? 0 : (n(f.baseFee) ?? 0),
    discountedFee: n(f.discountedFee),
    offerPrice: n(f.offerPrice),
    enrolmentFee: n(f.enrolmentFee) ?? 0,
    paymentRequired: f.feeType === "FREE" ? false : f.paymentRequired,
    customLabel: f.customLabel,
  };
}

const same = (a: FeeForm, b: FeeForm) => JSON.stringify(a) === JSON.stringify(b);

export function FeePlanEditor({
  courseId,
  plan,
  fallback,
  billed,
  offer,
  canEdit,
}: {
  courseId: string;
  plan: CourseFeePlanDto | null;
  fallback: FeePlanLike;
  /** The fees admission bills, from the course record — what the site shows when a plan cannot. */
  billed: { courseFee: number; registrationFee: number; examFee: number; certificateFee: number };
  offer: (OfferPricing & { title: string }) | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const initial = React.useMemo(() => toForm(plan, fallback), [plan, fallback]);
  const [values, setValues] = React.useState<FeeForm>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  // A save refreshes the page; when the new server values arrive they become the baseline. Compared
  // by value, not identity, so an unrelated refresh cannot discard unsaved edits — and adjusted
  // during render rather than in an effect, which would cost a second pass.
  const initialKey = JSON.stringify(initial);
  const [syncedKey, setSyncedKey] = React.useState(initialKey);
  const stale = syncedKey !== initialKey;
  if (stale) {
    setSyncedKey(initialKey);
    setValues(initial);
  }
  const form = stale ? initial : values;

  const dirty = !same(form, initial);
  const set = <K extends keyof FeeForm>(k: K, v: FeeForm[K]) => setValues((cur) => ({ ...cur, [k]: v }));

  /* The one formatter, on the live form values, with the site's rule on top: a plan that would read
     "No fee" for a course that bills something is not shown — the billed fees are (publicCourseFee). */
  const billedTotal = billed.courseFee + billed.registrationFee + billed.examFee + billed.certificateFee;
  const planPreview = formatCourseFee(planFromForm(form), offer);
  const previewFallsBack = planPreview.isFree && billedTotal > 0;
  const preview = previewFallsBack ? feeDisplayFromCourse(billed) : planPreview;
  const billedNow = feeDisplayFromCourse(billed);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await api.put(`/api/admin/courses/${courseId}/fee-plan`, {
        feeType: form.feeType,
        currency: form.currency.trim().toUpperCase() || "INR",
        baseFee: form.baseFee.trim() === "" ? 0 : form.baseFee.trim(),
        discountedFee: form.discountedFee.trim(),
        offerPrice: form.offerPrice.trim(),
        enrolmentFee: form.enrolmentFee.trim() === "" ? 0 : form.enrolmentFee.trim(),
        paymentRequired: form.paymentRequired,
        customLabel: form.customLabel,
        note: form.note,
      });
      toast.success("Fee plan saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await api.delete(`/api/admin/courses/${courseId}/fee-plan`);
      toast.success("Fee plan removed", "The site falls back to the course fee on the Overview tab.");
      setConfirmRemove(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not remove the fee plan", errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const amountsDisabled = saving || form.feeType === "FREE" || form.feeType === "CUSTOM";

  return (
    <form onSubmit={save} noValidate className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader title="How this course is priced" description={
              plan
                ? "Saved fee plan. The public page renders from this."
                : `No fee plan saved yet, so the site shows what admission bills: ${billedNow.label} ${billedNow.text}. Edit the values below and save to publish a plan.`
            } />
          <CardBody className="space-y-5">
            {formError && <Alert tone="danger">{formError}</Alert>}

            {/* `autoWire={false}`: RadioCards is a composite `role="radiogroup"`, not a single
                control, so Field must not hang an id / aria-describedby off it. Same call shape as
                the other RadioCards sites in the admin. */}
            <Field label="Fee type" required error={errors.feeType} autoWire={false}>
              <RadioCards name="feeType" value={form.feeType} onChange={(v) => set("feeType", v as CourseFeeType)} options={FEE_TYPE_OPTIONS} columns={2} />
            </Field>

            {form.feeType === "CUSTOM" && (
              <Field label="Custom label" required error={errors.customLabel} hint="This is the whole price line on the site, e.g. “Fee decided per batch”.">
                <Input value={form.customLabel} onChange={(e) => set("customLabel", e.target.value)} disabled={saving} maxLength={120} placeholder="Fee decided per batch" />
              </Field>
            )}

            <FormGrid>
              <Field label={form.feeType === "MONTHLY" ? "Amount per month" : "Base fee"} required={form.feeType === "ONE_TIME" || form.feeType === "MONTHLY"} error={errors.baseFee} hint={form.feeType === "FREE" ? "Not used when there is no fee." : form.feeType === "CUSTOM" ? "Not used for custom pricing." : "The price before any discount."}>
                <Input value={form.baseFee} onChange={(e) => set("baseFee", e.target.value.replace(/[^0-9.]/g, ""))} disabled={amountsDisabled} inputMode="decimal" />
              </Field>
              <Field label="Currency" error={errors.currency} hint="Three-letter code.">
                <Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} disabled={saving} maxLength={3} className="uppercase" />
              </Field>
              <Field label="Discounted fee" error={errors.discountedFee} hint="The standing lower price, if there is one.">
                <Input value={form.discountedFee} onChange={(e) => set("discountedFee", e.target.value.replace(/[^0-9.]/g, ""))} disabled={amountsDisabled} inputMode="decimal" />
              </Field>
              <Field label="Offer price" error={errors.offerPrice} hint="A campaign price on the plan itself, shown on the site. Admission bills the fees on the course record, so keep the two in step.">
                <Input value={form.offerPrice} onChange={(e) => set("offerPrice", e.target.value.replace(/[^0-9.]/g, ""))} disabled={amountsDisabled} inputMode="decimal" />
              </Field>
              <Field label="Enrolment fee" error={errors.enrolmentFee} hint="Shown separately from the course price.">
                <Input value={form.enrolmentFee} onChange={(e) => set("enrolmentFee", e.target.value.replace(/[^0-9.]/g, ""))} disabled={saving} inputMode="decimal" />
              </Field>
            </FormGrid>

            <Checkbox checked={form.paymentRequired} onChange={(e) => set("paymentRequired", e.target.checked)} disabled={saving || form.feeType === "FREE"} label="Payment is required to confirm a seat" description="Turn this off for a course that is billed later. “Pay later” is not the same as free." />

            <Field label="Note" error={errors.note} hint="An extra line under the price, e.g. what the fee includes.">
              <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={3} disabled={saving} maxLength={2000} />
            </Field>
          </CardBody>
        </Card>

        {canEdit && (
          <StickyActionBar>
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <p className="text-caption text-muted sm:mr-auto" role="status">
                {saving ? "Saving…" : dirty ? "Unsaved changes" : plan ? "Saved" : "Not saved yet"}
              </p>
              {plan && (
                <Button type="button" variant="outline" onClick={() => setConfirmRemove(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
                  Remove plan
                </Button>
              )}
              {dirty && (
                <Button type="button" variant="ghost" onClick={() => setValues(initial)} disabled={saving} leftIcon={<RotateCcw className="h-4 w-4" />}>
                  Reset
                </Button>
              )}
              {/* Only an edit can be saved: an untouched pre-fill would publish a plan nobody chose. */}
              <Button type="submit" loading={saving} disabled={!dirty}>
                Save fee plan
              </Button>
            </div>
          </StickyActionBar>
        )}
      </div>

      <div className="space-y-4">
        <FeePreview fee={preview} offerTitle={offer?.title ?? null} />
        {previewFallsBack && (
          <p className="text-caption text-muted">
            This course bills {billedNow.label.toLowerCase()} {billedNow.text}, so the site ignores “No fee” and shows what admission bills.
          </p>
        )}
        {form.note.trim() && (
          <Card>
            <CardHeader title="Note under the price" />
            <CardBody>
              <p className="text-body-sm whitespace-pre-line text-ink">{form.note}</p>
            </CardBody>
          </Card>
        )}
        {!offer && (
          <p className="text-caption text-muted">
            Offers on the <span className="font-semibold">Offers</span> tab are not shown on the public course page yet, so the preview shows the plan on its own.
          </p>
        )}
      </div>

      <ConfirmDialog open={confirmRemove} onClose={() => setConfirmRemove(false)} onConfirm={remove} title="Remove this fee plan?" description="The public page will fall back to the course fee on the Overview tab. Nothing a student has already been billed changes." confirmLabel="Remove" danger loading={removing} />
    </form>
  );
}
