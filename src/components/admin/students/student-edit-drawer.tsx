"use client";

import * as React from "react";
import { api } from "@/lib/api-client";
import { Drawer } from "@/components/ui/modal";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LocationCascade } from "@/components/shared/location-cascade";
import { GUARDIAN_RELATIONS, INCOME_BANDS, QUALIFICATIONS } from "@/lib/validation/students";
import { useMutation } from "@/components/admin/pickers/use-mutation";

export interface StudentEditValues {
  name: string;
  guardianName: string;
  guardianRelation: string;
  dob: string;
  gender: string;
  mobile: string;
  whatsapp: string;
  email: string;
  stateId: string;
  districtId: string;
  blockId: string;
  villageTown: string;
  address: string;
  pincode: string;
  qualification: string;
  institution: string;
  passingYear: string;
  familyIncome: string;
  occupation: string;
  areaType: string;
  trainingRequirement: string;
  scholarshipRequired: boolean;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

const SKIP_WHEN_BLANK: (keyof StudentEditValues)[] = ["stateId", "districtId", "blockId", "gender", "areaType", "dob", "guardianRelation", "familyIncome"];

function StudentEditForm({ onClose, studentId, initial }: { onClose: () => void; studentId: string; initial: StudentEditValues }) {
  const [v, setV] = React.useState<StudentEditValues>(initial);
  const { busy, fieldErrors, run } = useMutation();

  const set = <K extends keyof StudentEditValues>(k: K, val: StudentEditValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof StudentEditValues) => fieldErrors[k];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      const key = k as keyof StudentEditValues;
      if (SKIP_WHEN_BLANK.includes(key) && val === "") continue;
      if (key === "passingYear") {
        body[key] = val === "" ? null : Number(val);
        continue;
      }
      body[key] = val;
    }
    const r = await run(() => api.patch(`/api/admin/students/${studentId}`, body), { success: "Student profile updated" });
    if (r !== undefined) onClose();
  };

  const opts = (list: readonly string[]) => list.map((x) => ({ value: x, label: x }));

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title="Personal details">
        <FormGrid>
          <Field label="Full name" htmlFor="se-name" required error={err("name")}>
            <Input id="se-name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!err("name")} />
          </Field>
          <Field label="Date of birth" htmlFor="se-dob" error={err("dob")}>
            <Input id="se-dob" type="date" value={v.dob} onChange={(e) => set("dob", e.target.value)} invalid={!!err("dob")} />
          </Field>
          <Field label="Gender" htmlFor="se-gender" error={err("gender")}>
            <Select id="se-gender" value={v.gender} onChange={(e) => set("gender", e.target.value)} options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} placeholder="Select" />
          </Field>
          <Field label="Guardian name" htmlFor="se-guardian" error={err("guardianName")}>
            <Input id="se-guardian" value={v.guardianName} onChange={(e) => set("guardianName", e.target.value)} invalid={!!err("guardianName")} />
          </Field>
          <Field label="Guardian relation" htmlFor="se-relation" error={err("guardianRelation")}>
            <Select id="se-relation" value={v.guardianRelation} onChange={(e) => set("guardianRelation", e.target.value)} options={opts(GUARDIAN_RELATIONS)} placeholder="Select" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid>
          <Field label="Mobile" htmlFor="se-mobile" required error={err("mobile")}>
            <Input id="se-mobile" inputMode="numeric" value={v.mobile} onChange={(e) => set("mobile", e.target.value)} invalid={!!err("mobile")} />
          </Field>
          <Field label="WhatsApp" htmlFor="se-whatsapp" error={err("whatsapp")}>
            <Input id="se-whatsapp" inputMode="numeric" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} invalid={!!err("whatsapp")} />
          </Field>
          <Field label="Email" htmlFor="se-email" error={err("email")} className="sm:col-span-2">
            <Input id="se-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={!!err("email")} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Address">
        <LocationCascade
          value={{ stateId: v.stateId || undefined, districtId: v.districtId || undefined, blockId: v.blockId || undefined }}
          onChange={(loc) => setV((s) => ({ ...s, stateId: loc.stateId ?? "", districtId: loc.districtId ?? "", blockId: loc.blockId ?? "" }))}
          errors={{ stateId: err("stateId"), districtId: err("districtId"), blockId: err("blockId") }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        />
        <FormGrid>
          <Field label="Village / Town" htmlFor="se-village" error={err("villageTown")}>
            <Input id="se-village" value={v.villageTown} onChange={(e) => set("villageTown", e.target.value)} invalid={!!err("villageTown")} />
          </Field>
          <Field label="PIN code" htmlFor="se-pincode" error={err("pincode")}>
            <Input id="se-pincode" inputMode="numeric" value={v.pincode} onChange={(e) => set("pincode", e.target.value)} invalid={!!err("pincode")} />
          </Field>
          <Field label="Address" htmlFor="se-address" error={err("address")} className="sm:col-span-2">
            <Textarea id="se-address" rows={2} value={v.address} onChange={(e) => set("address", e.target.value)} invalid={!!err("address")} />
          </Field>
          <Field label="Area" htmlFor="se-area" error={err("areaType")}>
            <Select id="se-area" value={v.areaType} onChange={(e) => set("areaType", e.target.value)} options={[{ value: "RURAL", label: "Rural" }, { value: "URBAN", label: "Urban" }]} placeholder="Select" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Education & background">
        <FormGrid>
          <Field label="Highest qualification" htmlFor="se-qual" error={err("qualification")}>
            <Input id="se-qual" list="se-qual-list" value={v.qualification} onChange={(e) => set("qualification", e.target.value)} invalid={!!err("qualification")} />
            <datalist id="se-qual-list">
              {QUALIFICATIONS.map((q) => (
                <option key={q} value={q} />
              ))}
            </datalist>
          </Field>
          <Field label="Institution" htmlFor="se-inst" error={err("institution")}>
            <Input id="se-inst" value={v.institution} onChange={(e) => set("institution", e.target.value)} />
          </Field>
          <Field label="Passing year" htmlFor="se-year" error={err("passingYear")}>
            <Input id="se-year" type="number" min={1950} max={new Date().getFullYear() + 1} value={v.passingYear} onChange={(e) => set("passingYear", e.target.value)} invalid={!!err("passingYear")} />
          </Field>
          <Field label="Family income" htmlFor="se-income" error={err("familyIncome")}>
            <Select id="se-income" value={v.familyIncome} onChange={(e) => set("familyIncome", e.target.value)} options={opts(INCOME_BANDS)} placeholder="Select" />
          </Field>
          <Field label="Occupation" htmlFor="se-occ" error={err("occupation")}>
            <Input id="se-occ" value={v.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </Field>
          <Field label="Training requirement" htmlFor="se-req" error={err("trainingRequirement")} className="sm:col-span-2">
            <Textarea id="se-req" rows={2} value={v.trainingRequirement} onChange={(e) => set("trainingRequirement", e.target.value)} />
          </Field>
        </FormGrid>
        <Checkbox label="Needs scholarship support" checked={v.scholarshipRequired} onChange={(e) => set("scholarshipRequired", e.target.checked)} />
      </FormSection>

      <FormSection title="Account" description="Inactive or suspended accounts cannot log in.">
        <Field label="Account status" htmlFor="se-status" error={err("status")}>
          <Select id="se-status" value={v.status} onChange={(e) => set("status", e.target.value as StudentEditValues["status"])} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "SUSPENDED", label: "Suspended" }]} />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/** Edit drawer for staff; the form remounts every time the drawer opens so it always starts from the saved profile. */
export function StudentEditDrawer({ open, onClose, studentId, initial }: { open: boolean; onClose: () => void; studentId: string; initial: StudentEditValues }) {
  return (
    <Drawer open={open} onClose={onClose} title="Edit student" description="Changes are audited. Mobile and email must be unique across accounts." className="max-w-2xl">
      <StudentEditForm onClose={onClose} studentId={studentId} initial={initial} />
    </Drawer>
  );
}
