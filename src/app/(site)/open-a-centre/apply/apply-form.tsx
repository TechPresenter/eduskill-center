"use client";

import * as React from "react";
import Link from "next/link";
import { Armchair, CheckCircle2, Droplets, FileText, Pencil, Search, Toilet, Zap } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Checkbox, CheckboxCards, Input, RadioCards, Textarea } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select } from "@/components/ui/select";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { WizardShell } from "@/components/ui/wizard-shell";
import { toast } from "@/components/ui/toast";
import { LocationCascade } from "@/components/shared/location-cascade";
import { CentreSteps, type CentreStepItem } from "@/components/site/centre-steps";
import { CENTRE_DOCUMENT_TYPES, CENTRE_MAX_SPACE_PHOTOS } from "../centre-documents";

interface Option {
  value: string;
  label: string;
}

export interface CentreApplyFormProps {
  /** `CENTRE_STEPS` from the centre-application service (the seven-step process). */
  steps: readonly CentreStepItem[];
  /** `CENTRE_CLASSES` – classes a centre may run. */
  classes: readonly Option[];
  /** `SPACE_TYPES` – kinds of space the centre may use. */
  spaceTypes: readonly Option[];
}

interface Submitted {
  id: string;
  applicationNo: string;
  uploadToken: string;
}

interface FormState {
  applicantName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  dob: string;
  gender: string;
  qualification: string;
  occupation: string;
  teachingExperienceYears: string;
  stateId?: string;
  districtId?: string;
  blockId?: string;
  villageTown: string;
  address: string;
  pincode: string;
  proposedName: string;
  spaceType: string;
  roomCount: string;
  areaSqft: string;
  seatingCapacity: string;
  hasElectricity: boolean;
  hasToilet: boolean;
  hasDrinkingWater: boolean;
  hasFurniture: boolean;
  expectedStudents: string;
  classes: string[];
  motivation: string;
  acceptTerms: boolean;
}

const INITIAL: FormState = {
  applicantName: "",
  mobile: "",
  whatsapp: "",
  email: "",
  dob: "",
  gender: "",
  qualification: "",
  occupation: "",
  teachingExperienceYears: "0",
  villageTown: "",
  address: "",
  pincode: "",
  proposedName: "",
  spaceType: "OWN",
  roomCount: "1",
  areaSqft: "",
  seatingCapacity: "",
  hasElectricity: false,
  hasToilet: false,
  hasDrinkingWater: false,
  hasFurniture: false,
  expectedStudents: "",
  classes: [],
  motivation: "",
  acceptTerms: false,
};

const WIZARD_STEPS = [
  { label: "Applicant", description: "About you" },
  { label: "Location", description: "Where the centre will run" },
  { label: "Centre", description: "Space, rooms and classes" },
  { label: "Motivation", description: "Why you want to open it" },
  { label: "Review", description: "Check and submit" },
];

const LAST_STEP = WIZARD_STEPS.length - 1;

const STEP_FIELDS: string[][] = [
  ["applicantName", "mobile", "whatsapp", "email", "dob", "gender", "qualification", "occupation", "teachingExperienceYears"],
  ["stateId", "districtId", "blockId", "villageTown", "address", "pincode"],
  ["proposedName", "spaceType", "roomCount", "areaSqft", "seatingCapacity", "hasElectricity", "hasToilet", "hasDrinkingWater", "hasFurniture", "expectedStudents", "classes"],
  ["motivation", "acceptTerms"],
];

type FacilityKey = "hasElectricity" | "hasDrinkingWater" | "hasToilet" | "hasFurniture";

const FACILITIES: { value: FacilityKey; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "hasElectricity", label: "Electricity", description: "A working electricity connection", icon: <Zap className="h-5 w-5" /> },
  { value: "hasDrinkingWater", label: "Drinking water", description: "Safe drinking water for children", icon: <Droplets className="h-5 w-5" /> },
  { value: "hasToilet", label: "Toilet", description: "A usable toilet at or next to the space", icon: <Toilet className="h-5 w-5" /> },
  { value: "hasFurniture", label: "Furniture", description: "Mats, benches, desks or chairs", icon: <Armchair className="h-5 w-5" /> },
];

const SPACE_TYPE_HINTS: Record<string, string> = {
  OWN: "The room or building belongs to you or your family.",
  RENTED: "You rent the space where the centre will run.",
  COMMUNITY: "A panchayat, community or other public building you are allowed to use.",
  OTHER: "Any other arrangement — please explain it in the motivation step.",
};

const GENDERS: Option[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const MOBILE_RE = /^(\+?91[\s-]?)?[6-9]\d{9}$/;
const PIN_RE = /^[1-9]\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "esk.centreApplication.draft";
const SUBMITTED_KEY = "esk.centreApplication";

const SPACE_PHOTO = CENTRE_DOCUMENT_TYPES.find((d) => d.multiple);
const SINGLE_DOCS = CENTRE_DOCUMENT_TYPES.filter((d) => !d.multiple);

function intBetween(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
}

function validateStep(step: number, f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (f.applicantName.trim().length < 2) e.applicantName = "Enter your full name";
    if (!MOBILE_RE.test(f.mobile.trim())) e.mobile = "Enter a valid 10-digit Indian mobile number";
    if (f.whatsapp.trim() && !MOBILE_RE.test(f.whatsapp.trim())) e.whatsapp = "Enter a valid 10-digit WhatsApp number";
    if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address";
    if (f.dob && new Date(f.dob) > new Date()) e.dob = "Date of birth cannot be in the future";
    if (f.qualification.trim().length < 2) e.qualification = "Enter your highest qualification";
    if (!intBetween(f.teachingExperienceYears, 0, 60)) e.teachingExperienceYears = "Enter a number between 0 and 60";
  }
  if (step === 1) {
    if (!f.stateId) e.stateId = "Select your state";
    if (!f.districtId) e.districtId = "Select your district";
    if (!f.blockId) e.blockId = "Select your block";
    if (f.villageTown.trim().length < 2) e.villageTown = "Enter the village or town";
    if (f.address.trim().length < 5) e.address = "Enter the full address of the centre";
    if (!PIN_RE.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit PIN code";
  }
  if (step === 2) {
    if (f.proposedName.trim().length < 3) e.proposedName = "Enter a name for the centre";
    if (!f.spaceType) e.spaceType = "Select the kind of space";
    if (!intBetween(f.roomCount, 1, 50)) e.roomCount = "At least one room is required";
    if (f.areaSqft.trim() && !intBetween(f.areaSqft, 0, 100000)) e.areaSqft = "Enter the area in square feet (or leave it blank)";
    if (!intBetween(f.seatingCapacity, 1, 500)) e.seatingCapacity = "Enter how many children can sit";
    if (!intBetween(f.expectedStudents, 1, 500)) e.expectedStudents = "Enter the expected number of children";
    if (f.classes.length === 0) e.classes = "Select at least one class";
  }
  if (step === 3) {
    if (f.motivation.trim().length < 30) e.motivation = "Please write at least a few sentences (30+ characters)";
    if (!f.acceptTerms) e.acceptTerms = "You must accept the declaration to continue";
  }
  return e;
}

/** All steps before `upto`, so Review can never submit an incomplete form. */
function validateThrough(upto: number, f: FormState): { step: number; errors: Record<string, string> } | null {
  for (let s = 0; s <= upto; s++) {
    const errors = validateStep(s, f);
    if (Object.keys(errors).length) return { step: s, errors };
  }
  return null;
}

export function CentreApplyForm({ steps, classes, spaceTypes }: CentreApplyFormProps) {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<Submitted | null>(null);
  const [names, setNames] = React.useState<{ state?: string; district?: string; block?: string }>({});
  const [declarationOpen, setDeclarationOpen] = React.useState(false);
  const [draftSaved, setDraftSaved] = React.useState(false);
  const [photo, setPhoto] = React.useState<UploadedFile | null>(null);
  const [docs, setDocs] = React.useState<Record<string, UploadedFile | null>>({});
  const [spacePhotos, setSpacePhotos] = React.useState<(UploadedFile | null)[]>([null]);
  const topRef = React.useRef<HTMLDivElement>(null);

  /* ── Restore a saved draft / an in-progress upload step (survives a refresh) ── */
  React.useEffect(() => {
    const restore = setTimeout(() => {
      try {
        const rawSubmitted = sessionStorage.getItem(SUBMITTED_KEY);
        if (rawSubmitted) {
          const saved = JSON.parse(rawSubmitted) as Submitted & {
            docs?: Record<string, UploadedFile | null>;
            photo?: UploadedFile | null;
            spacePhotos?: (UploadedFile | null)[];
          };
          if (saved?.id && saved?.uploadToken) {
            setSubmitted({ id: saved.id, applicationNo: saved.applicationNo, uploadToken: saved.uploadToken });
            setDocs(saved.docs ?? {});
            setPhoto(saved.photo ?? null);
            setSpacePhotos(saved.spacePhotos?.length ? saved.spacePhotos : [null]);
            return;
          }
        }
        const rawDraft = localStorage.getItem(DRAFT_KEY);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft) as { form?: Partial<FormState>; step?: number };
          if (draft?.form) {
            setForm({ ...INITIAL, ...draft.form, acceptTerms: false });
            setStep(Math.min(Math.max(draft.step ?? 0, 0), LAST_STEP));
            setDraftSaved(true);
          }
        }
      } catch {
        /* ignore unreadable storage */
      }
    }, 0);
    return () => clearTimeout(restore);
  }, []);

  const persistSubmitted = React.useCallback((s: Submitted | null, d: Record<string, UploadedFile | null>, p: UploadedFile | null, sp: (UploadedFile | null)[]) => {
    try {
      if (!s) sessionStorage.removeItem(SUBMITTED_KEY);
      else sessionStorage.setItem(SUBMITTED_KEY, JSON.stringify({ ...s, docs: d, photo: p, spacePhotos: sp }));
    } catch {
      /* ignore */
    }
  }, []);

  const saveDraft = React.useCallback(
    (f: FormState, s: number) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: { ...f, acceptTerms: false }, step: s }));
        setDraftSaved(true);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const clearDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftSaved(false);
  }, []);

  /**
   * LocationCascade re-emits the display names on every render (its lists are fresh arrays until they load),
   * so the callback must keep the previous object when nothing changed — otherwise state updates loop.
   */
  const handleNames = React.useCallback((n: { state?: string; district?: string; block?: string }) => {
    setNames((prev) => (prev.state === n.state && prev.district === n.district && prev.block === n.block ? prev : n));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const goTo = (s: number) => {
    setStep(s);
    scrollTop();
  };

  const next = () => {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please correct the highlighted fields on this step.");
      return;
    }
    setFormError(null);
    saveDraft(form, Math.min(step + 1, LAST_STEP));
    goTo(Math.min(step + 1, LAST_STEP));
  };

  const back = () => {
    setFormError(null);
    goTo(Math.max(step - 1, 0));
  };

  const submit = async () => {
    const invalid = validateThrough(3, form);
    if (invalid) {
      setErrors(invalid.errors);
      setFormError("Some details are missing. Please complete the highlighted fields.");
      goTo(invalid.step);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        applicantName: form.applicantName.trim(),
        mobile: form.mobile.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        dob: form.dob || "",
        gender: form.gender || undefined,
        qualification: form.qualification.trim(),
        occupation: form.occupation.trim(),
        teachingExperienceYears: Number(form.teachingExperienceYears),
        stateId: form.stateId,
        districtId: form.districtId,
        blockId: form.blockId,
        villageTown: form.villageTown.trim(),
        address: form.address.trim(),
        pincode: form.pincode.trim(),
        proposedName: form.proposedName.trim(),
        spaceType: form.spaceType,
        roomCount: Number(form.roomCount),
        areaSqft: form.areaSqft.trim() ? Number(form.areaSqft) : null,
        seatingCapacity: Number(form.seatingCapacity),
        hasElectricity: form.hasElectricity,
        hasToilet: form.hasToilet,
        hasDrinkingWater: form.hasDrinkingWater,
        hasFurniture: form.hasFurniture,
        expectedStudents: Number(form.expectedStudents),
        classes: form.classes,
        motivation: form.motivation.trim(),
        acceptTerms: form.acceptTerms,
      };
      const data = await api.post<Submitted>("/api/public/centre-applications", payload);
      setSubmitted(data);
      persistSubmitted(data, {}, null, [null]);
      clearDraft();
      scrollTop();
      toast.success("Application submitted", `Your application number is ${data.applicationNo}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 422) {
          const fe = err.fieldErrors;
          setErrors(fe);
          const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => fe[f]));
          setFormError(err.message);
          goTo(firstStep >= 0 ? firstStep : 0);
        } else if (err.status === 409) {
          setFormError(
            <>
              {err.message}{" "}
              <Link href="/open-a-centre/status" className="font-semibold underline underline-offset-2">
                Track your application
              </Link>
              .
            </>
          );
          scrollTop();
        } else {
          setFormError(err.message);
          scrollTop();
        }
      } else {
        setFormError("Unable to submit your application. Please check your connection and try again.");
        scrollTop();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    persistSubmitted(null, {}, null, [null]);
    clearDraft();
    setSubmitted(null);
    setDocs({});
    setPhoto(null);
    setSpacePhotos([null]);
    setForm(INITIAL);
    setStep(0);
    scrollTop();
  };

  const setSpacePhoto = (index: number, file: UploadedFile | null) => {
    const nextPhotos = spacePhotos.map((p, i) => (i === index ? file : p));
    if (file && index === spacePhotos.length - 1 && spacePhotos.length < CENTRE_MAX_SPACE_PHOTOS) nextPhotos.push(null);
    setSpacePhotos(nextPhotos);
    if (submitted) persistSubmitted(submitted, docs, photo, nextPhotos);
  };

  const classOptions = classes.map((c) => ({ value: c.value, label: c.label }));
  const spaceOptions = spaceTypes.map((s) => ({ value: s.value, label: s.label, description: SPACE_TYPE_HINTS[s.value] }));
  const facilityValues = FACILITIES.filter((f) => form[f.value]).map((f) => f.value as string);
  const selectedClassLabels = classes.filter((c) => form.classes.includes(c.value)).map((c) => c.label);
  const facilityLabels = FACILITIES.filter((f) => form[f.value]).map((f) => f.label);
  const missingDocs = SINGLE_DOCS.filter((d) => d.required && !docs[d.key]);

  const declaration = (
    <div className="space-y-3 text-sm leading-relaxed text-ink">
      <p>By submitting this application I declare that:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>The information and documents I have given are true, complete and my own.</li>
        <li>I am applying to run a Normal Education Centre for Class 1 to 4 under the EduSkill Shiksha Mission, and I understand that the computer course is not part of it.</li>
        <li>EduSkill India Foundation may verify my documents, contact me and visit the proposed space before taking a decision.</li>
        <li>Submitting this form does not by itself authorise a centre. A centre may start only after selection, authorisation / agreement and orientation are complete.</li>
        <li>False or misleading information may lead to my application being rejected, or to an authorised centre being withdrawn.</li>
        <li>I agree to be contacted about this application by email, SMS, WhatsApp or phone.</li>
      </ul>
    </div>
  );

  /* ───────────────────────── Submitted ───────────────────────── */
  if (submitted) {
    const docEndpoint = `/api/public/centre-applications/${submitted.id}/documents`;
    return (
      <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-24 space-y-6">
        <Card>
          <CardBody className="p-6 text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
              <CheckCircle2 className="h-9 w-9" aria-hidden />
            </div>
            <h2 className="mt-5 font-heading text-2xl font-extrabold text-navy">Application received</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
              Thank you. Save your application number — you will need it, along with your registered mobile number, to track the seven-step process.
            </p>
            <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-muted uppercase">Application number</p>
            <p className="mt-1 font-heading text-3xl font-extrabold tracking-wide text-orange sm:text-4xl">{submitted.applicationNo}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <ButtonLink href={`/open-a-centre/status?no=${encodeURIComponent(submitted.applicationNo)}`} variant="navy" leftIcon={<Search className="h-4 w-4" />} fullWidth className="sm:w-auto">
                Track application status
              </ButtonLink>
              <ButtonLink href="/open-a-centre" variant="outline" fullWidth className="sm:w-auto">
                Back to Open a Centre
              </ButtonLink>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Where your application is now" description="Step 1 is complete. The Foundation will begin the document verification." />
          <CardBody>
            <CentreSteps steps={steps} current={1} completed={1} size="sm" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Upload your documents" description={`Application ${submitted.applicationNo} · Files are stored privately and are seen only by the Foundation's team.`} />
          <CardBody className="space-y-6">
            <Alert tone="info">
              You can upload now or later from the{" "}
              <Link href="/open-a-centre/status" className="font-semibold underline underline-offset-2">
                status page
              </Link>{" "}
              using your application number and mobile number. Step 2 of the process cannot be completed until the required documents are in.
            </Alert>

            <FormSection title="Your photograph" description="A recent, clear passport-style photo (JPG or PNG, up to 2 MB).">
              <FileUpload
                endpoint={`/api/public/centre-applications/${submitted.id}/photo`}
                fields={{ token: submitted.uploadToken }}
                accept=".jpg,.jpeg,.png"
                maxSizeMb={2}
                value={photo}
                onChange={(f) => {
                  setPhoto(f);
                  persistSubmitted(submitted, docs, f, spacePhotos);
                }}
                label="Upload photo"
                capture="user"
                preview={false}
              />
            </FormSection>

            <FormSection title="Identity and address documents" description="JPG, PNG or PDF up to 5 MB each.">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {SINGLE_DOCS.map((d) => (
                  <div key={d.key} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{d.name}</p>
                      <Badge tone={d.required ? "orange" : "neutral"}>{d.required ? "Required" : "Optional"}</Badge>
                    </div>
                    <p className="text-xs text-muted">{d.description}</p>
                    <FileUpload
                      endpoint={docEndpoint}
                      fields={{ token: submitted.uploadToken, type: d.key }}
                      accept={d.accept}
                      maxSizeMb={d.maxMb}
                      value={docs[d.key] ?? null}
                      onChange={(f) => {
                        const nextDocs = { ...docs, [d.key]: f };
                        setDocs(nextDocs);
                        persistSubmitted(submitted, nextDocs, photo, spacePhotos);
                      }}
                      label={`Upload ${d.name.toLowerCase()}`}
                      preview={false}
                    />
                  </div>
                ))}
              </div>
            </FormSection>

            {SPACE_PHOTO && (
              <FormSection title={SPACE_PHOTO.name} description={`${SPACE_PHOTO.description} Up to ${CENTRE_MAX_SPACE_PHOTOS} photos, ${SPACE_PHOTO.maxMb} MB each.`}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {spacePhotos.map((p, i) => (
                    <FileUpload
                      key={i}
                      endpoint={docEndpoint}
                      fields={{ token: submitted.uploadToken, type: SPACE_PHOTO.key }}
                      accept={SPACE_PHOTO.accept}
                      maxSizeMb={SPACE_PHOTO.maxMb}
                      value={p}
                      onChange={(f) => setSpacePhoto(i, f)}
                      label={`Upload photo ${i + 1}`}
                    />
                  ))}
                </div>
              </FormSection>
            )}

            {missingDocs.length > 0 && (
              <Alert tone="warning" title="Required documents are still missing">
                {missingDocs.map((d) => d.name).join(", ")}. You can finish now and upload them later from the status page.
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={startNew} className="min-h-11 text-sm font-medium text-muted hover:text-navy">
                Start a new application
              </button>
              <ButtonLink href={`/open-a-centre/status?no=${encodeURIComponent(submitted.applicationNo)}`} size="lg" fullWidth className="sm:w-auto">
                Done — view my status
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  /* ───────────────────────── Wizard ───────────────────────── */
  const formId = "centre-apply-form";

  return (
    <div ref={topRef} className="mx-auto max-w-4xl scroll-mt-24">
      <WizardShell
        steps={WIZARD_STEPS}
        current={step}
        onBack={step > 0 ? back : undefined}
        nextType="submit"
        form={formId}
        nextLabel={step === LAST_STEP ? "Submit application" : "Continue"}
        nextLoading={submitting}
        onSaveLater={
          step < LAST_STEP
            ? () => {
                if (saveDraft(form, step)) toast.success("Saved on this device", "Come back to this page to continue where you left off.");
                else toast.error("Could not save", "Your browser is blocking local storage.");
              }
            : undefined
        }
        footerNote={draftSaved ? "Draft saved on this device" : undefined}
      >
        {formError && (
          <Alert tone="danger" className="mb-5">
            {formError}
          </Alert>
        )}

        <Card>
          <CardBody className="p-5 sm:p-8">
            <form
              id={formId}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (step < LAST_STEP) next();
                else void submit();
              }}
            >
              {step === 0 && (
                <FormSection title="Applicant details" description="The person who will run the centre. We use these details to contact you about the application.">
                  <FormGrid>
                    <Field label="Full name" required error={errors.applicantName} className="sm:col-span-2">
                      <Input value={form.applicantName} onChange={(e) => set("applicantName", e.target.value)} invalid={!!errors.applicantName} autoComplete="name" />
                    </Field>
                    <Field label="Mobile number" required error={errors.mobile} hint="10-digit Indian mobile. Used to track the application.">
                      <Input inputMode="numeric" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} invalid={!!errors.mobile} autoComplete="tel" />
                    </Field>
                    <Field label="WhatsApp number" error={errors.whatsapp} hint="Leave blank if it is the same as your mobile.">
                      <Input inputMode="numeric" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} invalid={!!errors.whatsapp} />
                    </Field>
                    <Field label="Email address" required error={errors.email}>
                      <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} autoComplete="email" />
                    </Field>
                    <Field label="Date of birth" error={errors.dob}>
                      <DateInput value={form.dob} max={new Date()} onChange={(e) => set("dob", e.target.value)} invalid={!!errors.dob} />
                    </Field>
                    <Field label="Gender" error={errors.gender}>
                      <Select value={form.gender} onChange={(e) => set("gender", e.target.value)} placeholder="Prefer not to say" options={GENDERS} invalid={!!errors.gender} />
                    </Field>
                    <Field label="Highest qualification" required error={errors.qualification} hint="For example: B.A., 12th pass, D.El.Ed.">
                      <Input value={form.qualification} onChange={(e) => set("qualification", e.target.value)} invalid={!!errors.qualification} />
                    </Field>
                    <Field label="Present occupation" error={errors.occupation} hint="Optional — what you do now.">
                      <Input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} invalid={!!errors.occupation} />
                    </Field>
                    <Field label="Teaching experience (years)" required error={errors.teachingExperienceYears} hint="Enter 0 if you have none.">
                      <Input type="number" inputMode="numeric" min={0} max={60} value={form.teachingExperienceYears} onChange={(e) => set("teachingExperienceYears", e.target.value)} invalid={!!errors.teachingExperienceYears} />
                    </Field>
                  </FormGrid>
                  <p className="text-xs text-muted">Your photograph and documents are uploaded on the next screen, right after you submit.</p>
                </FormSection>
              )}

              {step === 1 && (
                <FormSection title="Where the centre will run" description="Select the state, district and block, then give the exact village or town and address of the proposed centre.">
                  <LocationCascade
                    value={{ stateId: form.stateId, districtId: form.districtId, blockId: form.blockId }}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, ...v }));
                      setErrors((e) => {
                        const n = { ...e };
                        delete n.stateId;
                        delete n.districtId;
                        delete n.blockId;
                        return n;
                      });
                    }}
                    onNames={handleNames}
                    depth="block"
                    required
                    errors={{ stateId: errors.stateId, districtId: errors.districtId, blockId: errors.blockId }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                  />
                  <FormGrid>
                    <Field label="Village / town" required error={errors.villageTown}>
                      <Input value={form.villageTown} onChange={(e) => set("villageTown", e.target.value)} invalid={!!errors.villageTown} />
                    </Field>
                    <Field label="PIN code" required error={errors.pincode}>
                      <Input inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} invalid={!!errors.pincode} autoComplete="postal-code" />
                    </Field>
                    <Field label="Full address of the centre" required error={errors.address} className="sm:col-span-2" hint="House or building, street, landmark and panchayat.">
                      <Textarea rows={3} value={form.address} onChange={(e) => set("address", e.target.value)} invalid={!!errors.address} />
                    </Field>
                  </FormGrid>
                </FormSection>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <FormSection title="The proposed centre" description="Tell us about the space where Class 1 to 4 children would study.">
                    <FormGrid>
                      <Field label="Centre name" required error={errors.proposedName} className="sm:col-span-2" hint="For example: Saraswati Shiksha Kendra, Rampur.">
                        <Input value={form.proposedName} onChange={(e) => set("proposedName", e.target.value)} invalid={!!errors.proposedName} />
                      </Field>
                    </FormGrid>
                    <Field label="Kind of space" required error={errors.spaceType} autoWire={false}>
                      <RadioCards name="spaceType" value={form.spaceType} onChange={(v) => set("spaceType", v)} options={spaceOptions} columns={2} />
                    </Field>
                    <FormGrid cols={3}>
                      <Field label="Number of rooms" required error={errors.roomCount}>
                        <Input type="number" inputMode="numeric" min={1} max={50} value={form.roomCount} onChange={(e) => set("roomCount", e.target.value)} invalid={!!errors.roomCount} />
                      </Field>
                      <Field label="Approximate area (sq ft)" error={errors.areaSqft} hint="Optional.">
                        <Input type="number" inputMode="numeric" min={0} max={100000} value={form.areaSqft} onChange={(e) => set("areaSqft", e.target.value)} invalid={!!errors.areaSqft} />
                      </Field>
                      <Field label="Children who can sit" required error={errors.seatingCapacity} hint="Seating capacity of the space.">
                        <Input type="number" inputMode="numeric" min={1} max={500} value={form.seatingCapacity} onChange={(e) => set("seatingCapacity", e.target.value)} invalid={!!errors.seatingCapacity} />
                      </Field>
                    </FormGrid>
                  </FormSection>

                  <FormSection title="Facilities available" description="Tick everything the space already has. These are checked during the centre verification.">
                    <CheckboxCards
                      name="facilities"
                      value={facilityValues}
                      onChange={(selected) =>
                        setForm((f) => ({
                          ...f,
                          hasElectricity: selected.includes("hasElectricity"),
                          hasDrinkingWater: selected.includes("hasDrinkingWater"),
                          hasToilet: selected.includes("hasToilet"),
                          hasFurniture: selected.includes("hasFurniture"),
                        }))
                      }
                      options={FACILITIES.map((f) => ({ value: f.value, label: f.label, description: f.description, icon: f.icon }))}
                      columns={2}
                    />
                  </FormSection>

                  <FormSection title="Children and classes" description="Each class studies Hindi, English, Mathematics and EVS.">
                    <FormGrid>
                      <Field label="Children you expect to enrol" required error={errors.expectedStudents} hint="Your honest estimate for the first year.">
                        <Input type="number" inputMode="numeric" min={1} max={500} value={form.expectedStudents} onChange={(e) => set("expectedStudents", e.target.value)} invalid={!!errors.expectedStudents} />
                      </Field>
                    </FormGrid>
                    <Field label="Classes the centre will run" required error={errors.classes} autoWire={false}>
                      <div className="space-y-3">
                        <CheckboxCards name="classes" value={form.classes} onChange={(v) => set("classes", v)} options={classOptions} columns={2} />
                        <button
                          type="button"
                          onClick={() => set("classes", form.classes.length === classOptions.length ? [] : classOptions.map((c) => c.value))}
                          className="min-h-11 text-sm font-semibold text-navy underline-offset-4 hover:underline"
                        >
                          {form.classes.length === classOptions.length ? "Clear all classes" : "Select all four classes"}
                        </button>
                      </div>
                    </Field>
                  </FormSection>
                </div>
              )}

              {step === 3 && (
                <FormSection title="Motivation & declaration" description="In your own words, why do you want to open a Normal Education Centre in your area?">
                  <Field
                    label="Why do you want to open this centre?"
                    required
                    error={errors.motivation}
                    hint={`${form.motivation.trim().length} / 3000 characters (minimum 30). Tell us about the children in your area, the space you have and how you will run the daily classes.`}
                  >
                    <Textarea rows={7} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} invalid={!!errors.motivation} />
                  </Field>
                  <Field error={errors.acceptTerms}>
                    <Checkbox
                      checked={form.acceptTerms}
                      onChange={(e) => set("acceptTerms", e.target.checked)}
                      label="I accept the declaration below."
                      description="The information I have given is true, the Foundation may verify my documents and the proposed space, and a centre may start only after selection, authorisation and orientation."
                    />
                  </Field>
                  <button type="button" onClick={() => setDeclarationOpen(true)} className="min-h-11 text-sm font-semibold text-orange underline-offset-4 hover:underline">
                    Read the full declaration
                  </button>
                </FormSection>
              )}

              {step === LAST_STEP && (
                <div className="space-y-6">
                  <div className="border-b border-line pb-3">
                    <h3 className="text-base font-bold text-navy">Review &amp; submit</h3>
                    <p className="mt-0.5 text-sm text-muted">Check every detail. Use Edit to go back to a step — nothing is sent until you press Submit application.</p>
                  </div>

                  {[
                    {
                      step: 0,
                      title: "Applicant",
                      rows: [
                        { label: "Full name", value: form.applicantName },
                        { label: "Mobile", value: form.mobile },
                        { label: "WhatsApp", value: form.whatsapp || form.mobile },
                        { label: "Email", value: form.email },
                        { label: "Date of birth", value: form.dob || "Not given" },
                        { label: "Gender", value: GENDERS.find((g) => g.value === form.gender)?.label ?? "Not given" },
                        { label: "Qualification", value: form.qualification },
                        { label: "Occupation", value: form.occupation || "Not given" },
                        { label: "Teaching experience", value: `${form.teachingExperienceYears} year(s)` },
                      ],
                    },
                    {
                      step: 1,
                      title: "Location",
                      rows: [
                        { label: "State", value: names.state ?? "—" },
                        { label: "District", value: names.district ?? "—" },
                        { label: "Block", value: names.block ?? "—" },
                        { label: "Village / town", value: form.villageTown },
                        { label: "PIN code", value: form.pincode },
                        { label: "Address", value: form.address },
                      ],
                    },
                    {
                      step: 2,
                      title: "Proposed centre",
                      rows: [
                        { label: "Centre name", value: form.proposedName },
                        { label: "Kind of space", value: spaceTypes.find((s) => s.value === form.spaceType)?.label ?? form.spaceType },
                        { label: "Rooms", value: form.roomCount },
                        { label: "Area", value: form.areaSqft ? `${form.areaSqft} sq ft` : "Not given" },
                        { label: "Children who can sit", value: form.seatingCapacity },
                        { label: "Expected children", value: form.expectedStudents },
                        { label: "Facilities", value: facilityLabels.length ? facilityLabels.join(", ") : "None ticked" },
                        { label: "Classes", value: selectedClassLabels.join(", ") || "—" },
                      ],
                    },
                    {
                      step: 3,
                      title: "Motivation",
                      rows: [
                        { label: "Why this centre", value: form.motivation },
                        { label: "Declaration", value: form.acceptTerms ? "Accepted" : "Not accepted" },
                      ],
                    },
                  ].map((group) => (
                    <div key={group.step} className="rounded-2xl border border-line bg-surface/60 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-bold text-navy">{group.title}</h3>
                        <Button type="button" variant="ghost" size="sm" onClick={() => goTo(group.step)} leftIcon={<Pencil className="h-4 w-4" />}>
                          Edit
                        </Button>
                      </div>
                      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                        {group.rows.map((r) => (
                          <div key={r.label} className="min-w-0">
                            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{r.label}</dt>
                            <dd className="mt-0.5 text-sm break-words whitespace-pre-line text-ink">{r.value || "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}

                  <div className="flex items-start gap-3 rounded-2xl border border-orange/20 bg-orange-light/50 p-4">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-orange" aria-hidden />
                    <p className="text-sm text-navy">
                      After you submit we show your application number and ask for your photograph, identity proof and address proof. Photos of the proposed space are optional but help the
                      centre verification.
                    </p>
                  </div>

                  <p className="text-xs text-muted">
                    Pressing <span className="font-semibold text-ink">Submit application</span> sends the form to EduSkill India Foundation. You will receive your application number
                    immediately, plus an email and SMS confirmation.
                  </p>
                </div>
              )}
            </form>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          Already applied?{" "}
          <Link href="/open-a-centre/status" className="font-semibold text-orange hover:underline">
            Track your application status
          </Link>
        </p>
      </WizardShell>

      <BottomSheet open={declarationOpen} onClose={() => setDeclarationOpen(false)} title="Applicant declaration" size="lg">
        {declaration}
      </BottomSheet>
    </div>
  );
}
