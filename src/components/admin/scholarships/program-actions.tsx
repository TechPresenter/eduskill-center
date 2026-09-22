"use client";

import * as React from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateInputValue, formatINR, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Drawer } from "@/components/ui/modal";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";

export interface ProgramFormValues {
  name: string;
  slug: string;
  type: "FULL" | "PARTIAL" | "NEED_BASED" | "SPECIAL";
  description: string;
  eligibilityCriteria: string;
  percentage: string;
  fixedAmount: string;
  maxAmount: string;
  budget: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ProgramRecord {
  id: string;
  name: string;
  slug: string;
  type: "FULL" | "PARTIAL" | "NEED_BASED" | "SPECIAL";
  description: string | null;
  eligibilityCriteria: string | null;
  percentage: number | null;
  fixedAmount: number | null;
  maxAmount: number | null;
  budget: number | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  isActive: boolean;
  awardsCount: number;
  awardedTotal: number;
}

const TYPES = [
  { value: "FULL", label: "Full (100%)" },
  { value: "PARTIAL", label: "Partial" },
  { value: "NEED_BASED", label: "Need-based" },
  { value: "SPECIAL", label: "Special (decided case by case)" },
];

const EMPTY: ProgramFormValues = { name: "", slug: "", type: "PARTIAL", description: "", eligibilityCriteria: "", percentage: "", fixedAmount: "", maxAmount: "", budget: "", startDate: "", endDate: "", isActive: true };

function toValues(p: ProgramRecord): ProgramFormValues {
  return {
    name: p.name,
    slug: p.slug,
    type: p.type,
    description: p.description ?? "",
    eligibilityCriteria: p.eligibilityCriteria ?? "",
    percentage: p.percentage === null ? "" : String(p.percentage),
    fixedAmount: p.fixedAmount === null ? "" : String(p.fixedAmount),
    maxAmount: p.maxAmount === null ? "" : String(p.maxAmount),
    budget: p.budget === null ? "" : String(p.budget),
    startDate: dateInputValue(p.startDate),
    endDate: dateInputValue(p.endDate),
    isActive: p.isActive,
  };
}

function ProgramForm({ program, onClose }: { program: ProgramRecord | null; onClose: () => void }) {
  const [v, setV] = React.useState<ProgramFormValues>(program ? toValues(program) : EMPTY);
  const [slugTouched, setSlugTouched] = React.useState(!!program);
  const { busy, fieldErrors, run } = useMutation();
  const set = <K extends keyof ProgramFormValues>(k: K, val: ProgramFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof ProgramFormValues) => fieldErrors[k];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...v, slug: v.slug || undefined, percentage: v.type === "FULL" && v.percentage === "" ? "100" : v.percentage };
    const r = await run(() => (program ? api.patch(`/api/admin/scholarships/programs/${program.id}`, body) : api.post("/api/admin/scholarships/programs", body)), { success: program ? "Program updated" : "Program created" });
    if (r !== undefined) onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title="Program">
        <FormGrid>
          <Field label="Name" htmlFor="pg-name" required error={err("name")} className="sm:col-span-2">
            <Input
              id="pg-name"
              value={v.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              invalid={!!err("name")}
            />
          </Field>
          <Field label="Slug" htmlFor="pg-slug" error={err("slug")} hint="Used in links and reports; lowercase letters, numbers and hyphens.">
            <Input
              id="pg-slug"
              value={v.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
              invalid={!!err("slug")}
            />
          </Field>
          <Field label="Type" htmlFor="pg-type" required error={err("type")}>
            <Select id="pg-type" value={v.type} onChange={(e) => set("type", e.target.value as ProgramFormValues["type"])} options={TYPES} />
          </Field>
          <Field label="Description" htmlFor="pg-desc" error={err("description")} className="sm:col-span-2">
            <Textarea id="pg-desc" rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Eligibility criteria" htmlFor="pg-elig" error={err("eligibilityCriteria")} className="sm:col-span-2" hint="Shown to staff when deciding requests.">
            <Textarea id="pg-elig" rows={2} value={v.eligibilityCriteria} onChange={(e) => set("eligibilityCriteria", e.target.value)} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Award amount" description={v.type === "SPECIAL" ? "Special programs have no default – the amount is entered on each decision." : "Enter a percentage of the course fee or a fixed amount. A cap can limit the award."}>
        <FormGrid cols={3}>
          <Field label="Percentage of fee" htmlFor="pg-pct" error={err("percentage")} required={v.type !== "SPECIAL" && !v.fixedAmount}>
            <Input id="pg-pct" type="number" inputMode="numeric" min={0} max={100} value={v.type === "FULL" ? "100" : v.percentage} onChange={(e) => set("percentage", e.target.value)} disabled={v.type === "FULL"} invalid={!!err("percentage")} />
          </Field>
          <Field label="Fixed amount (₹)" htmlFor="pg-fixed" error={err("fixedAmount")}>
            <Input id="pg-fixed" type="number" inputMode="decimal" min={0} value={v.fixedAmount} onChange={(e) => set("fixedAmount", e.target.value)} disabled={v.type === "FULL"} invalid={!!err("fixedAmount")} />
          </Field>
          <Field label="Maximum per student (₹)" htmlFor="pg-max" error={err("maxAmount")}>
            <Input id="pg-max" type="number" inputMode="decimal" min={0} value={v.maxAmount} onChange={(e) => set("maxAmount", e.target.value)} invalid={!!err("maxAmount")} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Budget & validity">
        <FormGrid cols={3}>
          <Field label="Total budget (₹)" htmlFor="pg-budget" error={err("budget")}>
            <Input id="pg-budget" type="number" inputMode="decimal" min={0} value={v.budget} onChange={(e) => set("budget", e.target.value)} invalid={!!err("budget")} />
          </Field>
          <Field label="Start date" htmlFor="pg-start" error={err("startDate")}>
            <Input id="pg-start" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} invalid={!!err("startDate")} />
          </Field>
          <Field label="End date" htmlFor="pg-end" error={err("endDate")}>
            <Input id="pg-end" type="date" value={v.endDate} min={v.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} invalid={!!err("endDate")} />
          </Field>
        </FormGrid>
        <Checkbox checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} label="Active" description="Only active programs can be selected when approving a scholarship." />
      </FormSection>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {program ? "Save changes" : "Create program"}
        </Button>
      </div>
    </form>
  );
}

/** "New program" button + drawer. */
export function NewProgramButton({ allowed }: { allowed: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Gate allowed={allowed} reason="You do not have permission to create programs">
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          New program
        </Button>
      </Gate>
      <Drawer open={open} onClose={() => setOpen(false)} title="New scholarship program" className="max-w-2xl">
        <ProgramForm program={null} onClose={() => setOpen(false)} />
      </Drawer>
    </>
  );
}

/** Row actions for a program: edit, activate/deactivate, delete. */
export function ProgramRowActions({ program, can }: { program: ProgramRecord; can: { update: boolean; delete: boolean } }) {
  const [edit, setEdit] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const { busy, run } = useMutation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Gate allowed={can.update} reason="You do not have permission to edit programs">
        <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(true)}>
          Edit
        </Button>
      </Gate>
      <Gate allowed={can.update} reason="You do not have permission to edit programs">
        <Button size="sm" variant="ghost" leftIcon={<Power className="h-3.5 w-3.5" />} disabled={busy} onClick={() => void run(() => api.patch(`/api/admin/scholarships/programs/${program.id}`, { isActive: !program.isActive }), { success: program.isActive ? "Program deactivated" : "Program activated" })}>
          {program.isActive ? "Deactivate" : "Activate"}
        </Button>
      </Gate>
      <Gate allowed={can.delete && program.awardsCount === 0} reason={program.awardsCount > 0 ? "Programs with awards cannot be deleted – deactivate instead" : "You do not have permission to delete programs"}>
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDel(true)} aria-label={`Delete ${program.name}`}>
          Delete
        </Button>
      </Gate>
      <Drawer open={edit} onClose={() => setEdit(false)} title="Edit scholarship program" description={`${program.awardsCount} award(s) · ${formatINR(program.awardedTotal)} approved so far`} className="max-w-2xl">
        <ProgramForm program={program} onClose={() => setEdit(false)} />
      </Drawer>
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title="Delete program"
        description={`Delete "${program.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={busy}
        onConfirm={async () => {
          const r = await run(() => api.delete(`/api/admin/scholarships/programs/${program.id}`), { success: "Program deleted" });
          if (r !== undefined) setDel(false);
        }}
      />
    </div>
  );
}
