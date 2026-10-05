"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Fab } from "@/components/ui/fab";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";
import { formatMoney } from "@/lib/course-pricing";
import type { CourseOfferDto } from "@/server/course-cms";
import { ImageField } from "@/components/admin/shared/image-field";
import { DragHandle, ReorderButtons, SortInstructions, SortStatus, sortableRowClasses, useSortable } from "@/components/admin/courses/sortable";
import { OFFER_STATE_META, type OfferState } from "@/components/admin/courses/offer-status";
import { cn } from "@/lib/utils";

/**
 * Offers for one course. The state badge on each row (Active now / Active, outranked / Scheduled /
 * Expired / Off) is computed on the server by `offerState()` from `isOfferEffective()` and the
 * bundle's `effectiveOfferId`, so nothing here re-implements the date window.
 *
 * Order matters and is editable: among the offers that are inside their dates, the lowest
 * `sortOrder` is the one the page shows.
 */

export interface OfferRow extends CourseOfferDto {
  state: OfferState;
}

interface OfferForm {
  title: string;
  description: string;
  discountPercent: string;
  originalPrice: string;
  offerPrice: string;
  couponCode: string;
  bannerImage: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** A Date as the value a `datetime-local` input wants, in the browser's own timezone. */
function toLocalInput(d: Date | string | null): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Back to an absolute instant, so the server never has to guess which timezone the text meant. */
function fromLocalInput(v: string): string {
  const t = v.trim();
  if (!t) return "";
  const date = new Date(t);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

const blankForm: OfferForm = { title: "", description: "", discountPercent: "", originalPrice: "", offerPrice: "", couponCode: "", bannerImage: "", startsAt: "", endsAt: "", isActive: true };

const toForm = (o: OfferRow): OfferForm => ({
  title: o.title,
  description: o.description ?? "",
  discountPercent: o.discountPercent == null ? "" : String(o.discountPercent),
  originalPrice: o.originalPrice == null ? "" : String(o.originalPrice),
  offerPrice: o.offerPrice == null ? "" : String(o.offerPrice),
  couponCode: o.couponCode ?? "",
  bannerImage: o.bannerImage ?? "",
  startsAt: toLocalInput(o.startsAt),
  endsAt: toLocalInput(o.endsAt),
  isActive: o.isActive,
});

export function OffersManager({ courseId, offers, currency, canEdit }: { courseId: string; offers: OfferRow[]; currency: string; canEdit: boolean }) {
  const router = useRouter();
  const formId = React.useId();
  const [editing, setEditing] = React.useState<OfferRow | "new" | null>(null);
  const [values, setValues] = React.useState<OfferForm>(blankForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<OfferRow | null>(null);
  const [removing, setRemoving] = React.useState(false);

  const ids = React.useMemo(() => offers.map((o) => o.id), [offers]);
  const byId = React.useMemo(() => new Map(offers.map((o) => [o.id, o])), [offers]);
  const labelOf = React.useCallback((id: string) => byId.get(id)?.title ?? "Offer", [byId]);

  const onCommit = React.useCallback(
    async (next: string[]) => {
      try {
        await api.post(`/api/admin/courses/${courseId}/offers/reorder`, { ids: next });
        router.refresh();
      } catch (err) {
        toast.error("Could not save the new order", errorMessage(err));
        throw err;
      }
    },
    [courseId, router]
  );

  const sortable = useSortable({ ids, labelOf, onCommit, disabled: !canEdit });
  const ordered = sortable.order.map((id) => byId.get(id)).filter((o): o is OfferRow => !!o);

  const set = <K extends keyof OfferForm>(k: K, v: OfferForm[K]) => setValues((cur) => ({ ...cur, [k]: v }));

  const open = (target: OfferRow | "new") => {
    setValues(target === "new" ? blankForm : toForm(target));
    setErrors({});
    setFormError(null);
    setEditing(target);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    const payload = {
      title: values.title,
      description: values.description,
      discountPercent: values.discountPercent.trim(),
      originalPrice: values.originalPrice.trim(),
      offerPrice: values.offerPrice.trim(),
      couponCode: values.couponCode,
      bannerImage: values.bannerImage,
      startsAt: fromLocalInput(values.startsAt),
      endsAt: fromLocalInput(values.endsAt),
      isActive: values.isActive,
    };
    try {
      if (editing === "new") await api.post(`/api/admin/courses/${courseId}/offers`, payload);
      else await api.put(`/api/admin/courses/${courseId}/offers/${editing.id}`, payload);
      toast.success(editing === "new" ? "Offer created" : "Offer updated");
      setEditing(null);
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
    if (!deleting) return;
    setRemoving(true);
    try {
      await api.delete(`/api/admin/courses/${courseId}/offers/${deleting.id}`);
      toast.success("Offer removed");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete the offer", errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const counts = offers.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.state]: (acc[o.state] ?? 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Offers"
          description={offers.length === 0 ? "A dated discount on this course. It starts and stops by itself — there is no switch to remember." : `${offers.length} offer${offers.length === 1 ? "" : "s"} · ${counts.LIVE ?? 0} active · ${counts.SCHEDULED ?? 0} scheduled · ${counts.EXPIRED ?? 0} expired`}
          action={
            canEdit ? (
              <Button size="sm" onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
                Add offer
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          {offers.length === 0 ? (
            <EmptyState
              icon={<BadgePercent className="h-7 w-7" />}
              title="No offers yet"
              description="Give the offer a start and end date and it starts and ends on its own. When several are active at once, the one highest in this list wins. Offers are not shown on the website yet."
              action={
                canEdit ? (
                  <Button onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />}>
                    Add the first offer
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <SortInstructions id={sortable.instructionsId} itemLabel="offer" />
              <SortStatus message={sortable.message} />
              {canEdit && offers.length > 1 && <p className="mb-3 text-caption text-muted">The order decides which active offer wins. Drag the handle, or focus it and use the arrow keys.</p>}
              <ul className="space-y-2">
                {ordered.map((offer) => {
                  const meta = OFFER_STATE_META[offer.state];
                  const actions = (
                    <>
                      {canEdit && <ReorderButtons sortable={sortable} id={offer.id} what={offer.title} />}
                      {canEdit && <IconButton size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`Edit ${offer.title}`} onClick={() => open(offer)} />}
                      {canEdit && <IconButton size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Delete ${offer.title}`} onClick={() => setDeleting(offer)} className="hover:bg-danger-light hover:text-danger" />}
                    </>
                  );
                  return (
                    <li key={offer.id}>
                      <div {...sortable.rowProps(offer.id)} className={cn("flex items-start gap-1 rounded-card border border-line bg-white pr-1.5", sortableRowClasses(sortable, offer.id), offer.state === "LIVE" && "border-success/50", sortable.saving && "opacity-70")}>
                        {canEdit && <DragHandle sortable={sortable} id={offer.id} className="mt-1" />}
                        <div className="min-w-0 flex-1 py-3 pl-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-navy">{offer.title}</span>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {offer.couponCode && <Badge tone="navy">{offer.couponCode}</Badge>}
                          </div>
                          <p className="mt-1 text-caption text-muted">{meta.hint}</p>
                          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption">
                            <div className="flex gap-1.5">
                              <dt className="text-muted">Price</dt>
                              <dd className="font-semibold text-ink tabular-nums">
                                {offer.offerPrice != null ? formatMoney(offer.offerPrice, currency) : offer.discountPercent != null ? `${offer.discountPercent}% off` : "—"}
                              </dd>
                            </div>
                            {offer.originalPrice != null && (
                              <div className="flex gap-1.5">
                                <dt className="text-muted">Was</dt>
                                <dd className="text-muted line-through tabular-nums">{formatMoney(offer.originalPrice, currency)}</dd>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <dt className="text-muted">Runs</dt>
                              <dd className="text-ink">
                                {offer.startsAt ? formatDateTime(offer.startsAt) : "Immediately"} &rarr; {offer.endsAt ? formatDateTime(offer.endsAt) : "No end date"}
                              </dd>
                            </div>
                          </dl>
                          {offer.description && <p className="mt-2 text-body-sm text-muted">{offer.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-0.5 sm:hidden">{actions}</div>
                        </div>
                        {offer.bannerImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={withBasePath(offer.bannerImage)} alt="" className="mt-3 hidden h-14 w-24 shrink-0 rounded-md border border-line object-cover sm:block" />
                        )}
                        <div className="hidden shrink-0 items-center gap-0.5 py-3 sm:flex">{actions}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      {canEdit && <Fab aria-label="Add offer" icon={<Plus className="h-6 w-6" aria-hidden />} onClick={() => open("new")} />}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        size="lg"
        title={editing === "new" ? "Add offer" : "Edit offer"}
        description={editing && editing !== "new" ? editing.title : undefined}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {editing === "new" ? "Create offer" : "Save changes"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}

          <Field label="Title" required error={errors.title}>
            <Input value={values.title} onChange={(e) => set("title", e.target.value)} disabled={saving} maxLength={160} placeholder="Republic Day admission offer" />
          </Field>

          <Field label="Description" error={errors.description}>
            <Textarea value={values.description} onChange={(e) => set("description", e.target.value)} rows={3} disabled={saving} maxLength={2000} />
          </Field>

          <FormGrid>
            <Field label="Offer price" error={errors.offerPrice} hint="Either a price or a percentage is needed.">
              <Input value={values.offerPrice} onChange={(e) => set("offerPrice", e.target.value.replace(/[^0-9.]/g, ""))} disabled={saving} inputMode="decimal" />
            </Field>
            <Field label="Discount percent" error={errors.discountPercent} hint="Applied to the fee plan's base fee.">
              <Input value={values.discountPercent} onChange={(e) => set("discountPercent", e.target.value.replace(/[^0-9]/g, ""))} disabled={saving} inputMode="numeric" />
            </Field>
            <Field label="Original price" error={errors.originalPrice} hint="The struck-through “before” price. Leave blank to use the base fee.">
              <Input value={values.originalPrice} onChange={(e) => set("originalPrice", e.target.value.replace(/[^0-9.]/g, ""))} disabled={saving} inputMode="decimal" />
            </Field>
            <Field label="Coupon code" error={errors.couponCode}>
              <Input value={values.couponCode} onChange={(e) => set("couponCode", e.target.value.toUpperCase())} disabled={saving} maxLength={40} className="uppercase" />
            </Field>
            <Field label="Starts at" error={errors.startsAt} hint="Blank means it is active straight away.">
              <Input type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} disabled={saving} />
            </Field>
            <Field label="Ends at" error={errors.endsAt} hint="Blank means it never expires.">
              <Input type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} disabled={saving} />
            </Field>
          </FormGrid>

          <Field label="Banner image" error={errors.bannerImage} hint="Optional artwork for the offer strip.">
            <ImageField value={values.bannerImage} onChange={(v) => set("bannerImage", v)} folder={`courses/${courseId}/offers`} disabled={saving} />
          </Field>

          <Checkbox checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} disabled={saving} label="Offer is switched on" description="Off disables it whatever the dates say. Inside its dates and on, it is active." />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete this offer?" description={deleting ? `"${deleting.title}" will be removed from this course.` : null} confirmLabel="Delete" danger loading={removing} />
    </div>
  );
}
