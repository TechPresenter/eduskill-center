"use client";

import * as React from "react";
import { CalendarClock, Percent, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateInputValue, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

const NO_PERM = "You do not have permission for this action";

/** Apply / change the discount on an application. */
export function DiscountButton({ applicationId, originalFee, scholarshipAmount, discountAmount, allowed, reason }: { applicationId: string; originalFee: number; scholarshipAmount: number; discountAmount: number; allowed: boolean; reason?: string }) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(String(discountAmount));
  const [note, setNote] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  const max = Math.max(0, originalFee - scholarshipAmount);
  const n = Number(amount);
  const payable = Number.isFinite(n) ? Math.max(0, originalFee - scholarshipAmount - n) : null;
  const close = () => {
    clearErrors();
    setLocalError(null);
    setOpen(false);
  };
  return (
    <>
      <Gate allowed={allowed} reason={reason ?? NO_PERM}>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Percent className="h-3.5 w-3.5" />}
          onClick={() => {
            setAmount(String(discountAmount));
            setNote("");
            setOpen(true);
          }}
        >
          {discountAmount > 0 ? "Change discount" : "Apply discount"}
        </Button>
      </Gate>
      <Modal open={open} onClose={close} title="Fee discount" description="A one-off concession granted by the Foundation. Scholarship plus discount cannot exceed the original fee." size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!Number.isFinite(n) || n < 0) {
              setLocalError("Enter a valid amount");
              return;
            }
            if (n > max) {
              setLocalError(`Discount cannot exceed ${formatINR(max)}`);
              return;
            }
            setLocalError(null);
            const r = await run(() => api.post<{ payableAmount: number }>(`/api/admin/applications/${applicationId}/discount`, { discountAmount: n, note: note.trim() || undefined }), {
              success: (d) => `Discount saved – payable ${formatINR(d.payableAmount)}`,
            });
            if (r !== undefined) close();
          }}
          noValidate
        >
          <Field label="Discount amount" htmlFor="disc-amount" required hint={`Maximum ${formatINR(max)}`} error={localError ?? fieldErrors.discountAmount}>
            <Input id="disc-amount" type="number" inputMode="decimal" min={0} max={max} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!(localError ?? fieldErrors.discountAmount)} />
          </Field>
          <Field label="Note (optional)" htmlFor="disc-note" error={fieldErrors.note}>
            <Textarea id="disc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the concession" />
          </Field>
          {payable !== null && (
            <p className="text-body-sm text-muted">
              New payable fee: <span className="font-semibold text-navy tabular-nums">{formatINR(payable)}</span>
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save discount
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Toggle whether the student may pay in installments. */
export function InstallmentsToggle({ applicationId, value, allowed }: { applicationId: string; value: boolean; allowed: boolean }) {
  const { busy, run } = useMutation();
  return (
    <Checkbox
      checked={value}
      disabled={!allowed || busy}
      title={allowed ? undefined : NO_PERM}
      onChange={(e) => void run(() => api.patch(`/api/admin/applications/${applicationId}/installments`, { allowed: e.target.checked }), { success: e.target.checked ? "Installments allowed" : "Installments disabled" })}
      label="Allow payment in installments"
      description="When enabled the student may pay part of the fee at a time and the admission can be confirmed with a partial payment."
    />
  );
}

interface PlanRow {
  amount: string;
  dueDate: string;
}

/** Builds / replaces the pending installment plan (must total the due amount). */
export function InstallmentPlanButton({ applicationId, due, existing, allowed }: { applicationId: string; due: number; existing: { amount: number; dueDate: string | Date; status: string }[]; allowed: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<PlanRow[]>([]);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const { busy, fieldErrors, run, clearErrors } = useMutation();

  const defaultRows = (): PlanRow[] => {
    const pending = existing.filter((i) => i.status === "PENDING");
    if (pending.length) return pending.map((i) => ({ amount: String(i.amount), dueDate: dateInputValue(i.dueDate) }));
    const first = Math.round((due / 2) * 100) / 100;
    const today = new Date();
    const next = new Date(today.getTime() + 30 * 86400000);
    return [
      { amount: String(first), dueDate: dateInputValue(today) },
      { amount: String(Math.round((due - first) * 100) / 100), dueDate: dateInputValue(next) },
    ];
  };
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = Math.round((total - due) * 100) / 100;
  const close = () => {
    clearErrors();
    setLocalError(null);
    setOpen(false);
  };
  const set = (i: number, patch: Partial<PlanRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <>
      <Gate allowed={allowed && due > 0} reason={due <= 0 ? "Nothing is due" : NO_PERM}>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
          onClick={() => {
            setRows(defaultRows());
            setOpen(true);
          }}
        >
          {existing.some((i) => i.status === "PENDING") ? "Edit installment plan" : "Create installment plan"}
        </Button>
      </Gate>
      {open && (
        <Drawer open onClose={close} title="Installment plan" description={`Split the due amount of ${formatINR(due)} into up to 12 installments. Saving replaces any pending plan and enables installments.`} className="max-w-xl">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (rows.length === 0) {
                setLocalError("Add at least one installment");
                return;
              }
              if (rows.some((r) => !(Number(r.amount) > 0) || !r.dueDate)) {
                setLocalError("Every installment needs an amount and a due date");
                return;
              }
              if (Math.abs(diff) > 0.01) {
                setLocalError(`Installments must total ${formatINR(due)} (currently ${formatINR(total)})`);
                return;
              }
              setLocalError(null);
              const r = await run(() => api.post(`/api/admin/applications/${applicationId}/installments`, { plan: rows.map((x) => ({ amount: Number(x.amount), dueDate: x.dueDate })) }), { success: `${rows.length}-installment plan saved` });
              if (r !== undefined) close();
            }}
            noValidate
          >
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
                  <span className="pb-3 text-caption font-semibold text-muted">#{i + 1}</span>
                  <Field label={i === 0 ? "Amount" : undefined} htmlFor={`inst-amt-${i}`}>
                    <Input id={`inst-amt-${i}`} type="number" inputMode="decimal" min={1} step="1" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} aria-label={`Installment ${i + 1} amount`} />
                  </Field>
                  <Field label={i === 0 ? "Due date" : undefined} htmlFor={`inst-date-${i}`}>
                    <Input id={`inst-date-${i}`} type="date" value={r.dueDate} onChange={(e) => set(i, { dueDate: e.target.value })} aria-label={`Installment ${i + 1} due date`} />
                  </Field>
                  <Button type="button" variant="ghost" size="sm" className="mb-0.5 text-danger hover:bg-danger-light" aria-label={`Remove installment ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} disabled={rows.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} disabled={rows.length >= 12} onClick={() => setRows((rs) => [...rs, { amount: String(Math.max(0, diff < 0 ? -diff : 0)), dueDate: "" }])}>
                Add installment
              </Button>
              <p className={`text-body-sm tabular-nums ${Math.abs(diff) > 0.01 ? "text-warning-dark" : "text-success-dark"}`}>
                Total {formatINR(total)} of {formatINR(due)}
                {Math.abs(diff) > 0.01 && ` (${diff > 0 ? "over" : "short"} by ${formatINR(Math.abs(diff))})`}
              </p>
            </div>
            {(localError ?? fieldErrors.plan) && (
              <Alert tone="danger">{localError ?? fieldErrors.plan}</Alert>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save plan
              </Button>
            </div>
          </form>
        </Drawer>
      )}
    </>
  );
}
