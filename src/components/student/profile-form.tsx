"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, RadioCards, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormActions, FormGrid, FormSection } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Card, CardBody } from "@/components/ui/card";
import { LocationCascade } from "@/components/shared/location-cascade";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { GUARDIAN_RELATIONS, INCOME_BANDS, QUALIFICATIONS } from "@/lib/validation/students";

export interface ProfileFormValues {
  name: string;
  guardianName: string;
  guardianRelation: string;
  dob: string;
  gender: string;
  mobile: string;
  whatsapp: string;
  email: string;
  photoUrl: string;
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
}

/** Setter shared by the form and the extracted field groups. */
export type ProfileFieldSetter = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;

export interface ProfileFieldGroupProps {
  form: ProfileFormValues;
  set: ProfileFieldSetter;
  /** Server / client validation errors keyed by field name. */
  errors: Record<string, string>;
}

/** Fields that must be filled before an application can be submitted. */
export const PROFILE_REQUIRED: (keyof ProfileFormValues)[] = ["name", "guardianName", "guardianRelation", "dob", "gender", "mobile", "stateId", "districtId", "blockId", "villageTown", "address", "pincode", "qualification"];

/** Which field group (= apply-wizard step) each field belongs to. */
export const PERSONAL_FIELDS: (keyof ProfileFormValues)[] = ["photoUrl", "name", "guardianName", "guardianRelation", "dob", "gender", "mobile", "whatsapp", "email"];
export const ADDRESS_FIELDS: (keyof ProfileFormValues)[] = ["stateId", "districtId", "blockId", "villageTown", "address", "pincode"];
export const EDUCATION_FIELDS: (keyof ProfileFormValues)[] = ["qualification", "institution", "passingYear", "familyIncome", "occupation", "areaType", "trainingRequirement", "scholarshipRequired"];

export const PROFILE_LABELS: Record<keyof ProfileFormValues, string> = {
  name: "Full name",
  guardianName: "Guardian name",
  guardianRelation: "Relation",
  dob: "Date of birth",
  gender: "Gender",
  mobile: "Mobile",
  whatsapp: "WhatsApp",
  email: "Email",
  photoUrl: "Photo",
  stateId: "State",
  districtId: "District",
  blockId: "Block",
  villageTown: "Village / Town",
  address: "Address",
  pincode: "PIN code",
  qualification: "Qualification",
  institution: "Institution",
  passingYear: "Year of passing",
  familyIncome: "Family income",
  occupation: "Occupation",
  areaType: "Area",
  trainingRequirement: "Training requirement",
  scholarshipRequired: "Scholarship",
};

/** Missing required fields + completion percentage, shared by the profile page and the wizard. */
export function profileCompletion(form: ProfileFormValues) {
  const missing = PROFILE_REQUIRED.filter((k) => !String(form[k] ?? "").trim());
  return { missing, completion: Math.round(((PROFILE_REQUIRED.length - missing.length) / PROFILE_REQUIRED.length) * 100) };
}

/** Request body for `PUT /api/student/profile` built from the form values. */
export function profilePayload(form: ProfileFormValues) {
  return {
    ...form,
    photoUrl: form.photoUrl || null,
    whatsapp: form.whatsapp || null,
    email: form.email || null,
    institution: form.institution || null,
    passingYear: form.passingYear ? Number(form.passingYear) : null,
    familyIncome: form.familyIncome || null,
    occupation: form.occupation || null,
    areaType: form.areaType || null,
    trainingRequirement: form.trainingRequirement || null,
  };
}

function photoValue(url: string): UploadedFile | null {
  return url ? { key: "", url, name: "Profile photo", mimeType: "image/jpeg", size: 0 } : null;
}

/* ─────────────────────────── Field groups (wizard steps 1–3) ─────────────────────────── */

/** Photo, name, guardian, date of birth and gender. Stacks on phones; photo sits left from `md`. */
export function PersonalDetailsFields({ form, set, errors }: ProfileFieldGroupProps) {
  const [photo, setPhoto] = React.useState<UploadedFile | null>(() => photoValue(form.photoUrl));
  const onPhoto = (f: UploadedFile | null) => {
    setPhoto(f);
    set("photoUrl", f?.url ?? "");
  };
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
      <Field label="Photo" hint="Passport-size, JPG/PNG up to 5 MB." error={errors.photoUrl}>
        <FileUpload
          endpoint="/api/student/uploads?kind=photo"
          accept=".jpg,.jpeg,.png,.webp"
          maxSizeMb={5}
          value={photo}
          onChange={onPhoto}
          sources={["camera", "gallery", "files"]}
          capture="user"
          label="Upload photo"
          hint="JPG / PNG up to 5 MB"
        />
      </Field>
      <FormGrid>
        <Field label="Full name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
          <Input id="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label="Guardian name" htmlFor="guardianName" required error={errors.guardianName}>
          <Input id="guardianName" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} invalid={!!errors.guardianName} />
        </Field>
        <Field label="Relation" htmlFor="guardianRelation" required error={errors.guardianRelation}>
          <Select id="guardianRelation" value={form.guardianRelation} onChange={(e) => set("guardianRelation", e.target.value)} options={GUARDIAN_RELATIONS.map((r) => ({ value: r, label: r }))} placeholder="Select relation" invalid={!!errors.guardianRelation} />
        </Field>
        <Field label="Date of birth" htmlFor="dob" required error={errors.dob}>
          <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e) => set("dob", e.target.value)} invalid={!!errors.dob} />
        </Field>
        <Field label="Gender" required error={errors.gender}>
          <RadioCards name="gender" value={form.gender} onChange={(v) => set("gender", v)} columns={3} options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} />
        </Field>
      </FormGrid>
    </div>
  );
}

/** Mobile, WhatsApp and email. */
export function ContactFields({ form, set, errors }: ProfileFieldGroupProps) {
  return (
    <FormGrid cols={3}>
      <Field label="Mobile number" htmlFor="mobile" required error={errors.mobile} hint="Used for login and SMS updates.">
        <Input id="mobile" inputMode="numeric" autoComplete="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} invalid={!!errors.mobile} />
      </Field>
      <Field label="WhatsApp number" htmlFor="whatsapp" error={errors.whatsapp} hint="Leave empty if same as mobile.">
        <Input id="whatsapp" inputMode="numeric" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} invalid={!!errors.whatsapp} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
      </Field>
    </FormGrid>
  );
}

/** State / district / block cascade plus village, address and PIN code. */
export function AddressFields({ form, set, errors }: ProfileFieldGroupProps) {
  return (
    <div className="space-y-5">
      <LocationCascade
        value={{ stateId: form.stateId || undefined, districtId: form.districtId || undefined, blockId: form.blockId || undefined }}
        onChange={(v) => {
          set("stateId", v.stateId ?? "");
          set("districtId", v.districtId ?? "");
          set("blockId", v.blockId ?? "");
        }}
        required
        errors={{ stateId: errors.stateId, districtId: errors.districtId, blockId: errors.blockId }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      />
      <FormGrid cols={3}>
        <Field label="Village / Town" htmlFor="villageTown" required error={errors.villageTown}>
          <Input id="villageTown" value={form.villageTown} onChange={(e) => set("villageTown", e.target.value)} invalid={!!errors.villageTown} />
        </Field>
        <Field label="Address" htmlFor="address" required error={errors.address} className="sm:col-span-2">
          <Input id="address" autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} invalid={!!errors.address} />
        </Field>
        <Field label="PIN code" htmlFor="pincode" required error={errors.pincode}>
          <Input id="pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} invalid={!!errors.pincode} />
        </Field>
      </FormGrid>
    </div>
  );
}

/** Highest qualification, institution and year of passing. */
export function EducationFields({ form, set, errors }: ProfileFieldGroupProps) {
  const qualificationOptions = [
    ...QUALIFICATIONS.map((q) => ({ value: q, label: q })),
    ...(form.qualification && !(QUALIFICATIONS as readonly string[]).includes(form.qualification) ? [{ value: form.qualification, label: form.qualification }] : []),
  ];
  return (
    <FormGrid cols={3}>
      <Field label="Highest qualification" htmlFor="qualification" required error={errors.qualification}>
        <Select id="qualification" value={form.qualification} onChange={(e) => set("qualification", e.target.value)} options={qualificationOptions} placeholder="Select qualification" invalid={!!errors.qualification} />
      </Field>
      <Field label="School / Institution" htmlFor="institution" error={errors.institution}>
        <Input id="institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} invalid={!!errors.institution} />
      </Field>
      <Field label="Year of passing" htmlFor="passingYear" error={errors.passingYear}>
        <Input id="passingYear" inputMode="numeric" type="number" min={1950} max={new Date().getFullYear() + 1} value={form.passingYear} onChange={(e) => set("passingYear", e.target.value)} invalid={!!errors.passingYear} />
      </Field>
    </FormGrid>
  );
}

/** Income, occupation, area type, training goal and the scholarship flag (optional but recommended). */
export function AdditionalInfoFields({ form, set, errors }: ProfileFieldGroupProps) {
  return (
    <FormGrid cols={2}>
      <Field label="Annual family income" htmlFor="familyIncome" error={errors.familyIncome}>
        <Select id="familyIncome" value={form.familyIncome} onChange={(e) => set("familyIncome", e.target.value)} options={INCOME_BANDS.map((b) => ({ value: b, label: b }))} placeholder="Select income band" invalid={!!errors.familyIncome} />
      </Field>
      <Field label="Current occupation" htmlFor="occupation" error={errors.occupation} hint="e.g. Student, Homemaker, Daily wage worker">
        <Input id="occupation" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} invalid={!!errors.occupation} />
      </Field>
      <Field label="Area" error={errors.areaType} className="sm:col-span-2">
        <RadioCards name="areaType" value={form.areaType} onChange={(v) => set("areaType", v)} columns={2} options={[{ value: "RURAL", label: "Rural", description: "Village or panchayat area" }, { value: "URBAN", label: "Urban", description: "Town or city" }]} />
      </Field>
      <Field label="What training are you looking for?" htmlFor="trainingRequirement" error={errors.trainingRequirement} className="sm:col-span-2">
        <Textarea id="trainingRequirement" rows={3} value={form.trainingRequirement} onChange={(e) => set("trainingRequirement", e.target.value)} invalid={!!errors.trainingRequirement} placeholder="Tell us about your goals, the skills you want to learn or the job you are aiming for." />
      </Field>
      <Field error={errors.scholarshipRequired} className="sm:col-span-2">
        <Checkbox checked={form.scholarshipRequired} onChange={(e) => set("scholarshipRequired", e.target.checked)} label="I need scholarship support" description="You can also request a scholarship for a specific course while applying. Decisions are made by the Foundation." />
      </Field>
    </FormGrid>
  );
}

/* ─────────────────────────── Full profile form ─────────────────────────── */

export function ProfileForm({ initial, profileCompleted, studentCode, welcome }: { initial: ProfileFormValues; profileCompleted: boolean; studentCode: string | null; welcome?: boolean }) {
  const router = useRouter();
  const [form, setForm] = React.useState<ProfileFormValues>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const set = React.useCallback<ProfileFieldSetter>((k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  }, []);

  const { missing, completion } = profileCompletion(form);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    setSaving(true);
    try {
      await api.put("/api/student/profile", profilePayload(form));
      toast.success("Profile saved", "Your profile is complete. You can now apply for a course.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.message);
        const first = Object.keys(err.fieldErrors)[0];
        if (first) document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else setError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const groupProps: ProfileFieldGroupProps = { form, set, errors };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {welcome && !profileCompleted && (
        <Alert tone="success" title="Welcome! One more step">
          Fill in your profile below. Everything marked with * is required before you can apply for a course.
        </Alert>
      )}
      {profileCompleted || saved ? (
        <Alert tone="success" title="Profile complete" action={<ButtonLink href="/student/apply" size="sm" variant="navy">Find a center & apply</ButtonLink>}>
          {studentCode ? `Student ID ${studentCode}. ` : ""}You can update your details at any time. Changes to your name reflect on future certificates only.
        </Alert>
      ) : (
        <Alert tone="warning" title={`Profile ${completion}% complete`}>
          {missing.length > 0 ? `Please fill in: ${missing.map((k) => PROFILE_LABELS[k]).join(", ")}.` : "All required fields are filled. Press Save profile to finish."}
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardBody className="space-y-8">
          <FormSection id="personal" title="Personal details">
            <PersonalDetailsFields {...groupProps} />
          </FormSection>

          <FormSection id="contact" title="Contact">
            <ContactFields {...groupProps} />
          </FormSection>

          <FormSection id="address" title="Address" description="Choose your state, district and block so we can suggest training centers near you.">
            <AddressFields {...groupProps} />
          </FormSection>

          <FormSection id="education" title="Education">
            <EducationFields {...groupProps} />
          </FormSection>

          <FormSection id="additional" title="Additional information" description="Helps the Foundation decide scholarships and plan courses. Optional but recommended.">
            <AdditionalInfoFields {...groupProps} />
          </FormSection>

          <FormActions>
            <Link href="/student/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-5 text-body-sm font-semibold text-ink hover:bg-surface">
              Cancel
            </Link>
            <Button type="submit" loading={saving} size="md">
              Save profile
            </Button>
          </FormActions>
        </CardBody>
      </Card>
    </form>
  );
}
