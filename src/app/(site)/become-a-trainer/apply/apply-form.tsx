"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, RadioCards, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { phoneIssue } from "@/lib/phone";
import { Select } from "@/components/ui/select";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Timeline } from "@/components/ui/misc";
import { WizardShell } from "@/components/ui/wizard-shell";
import { FileUpload, TagInput, type UploadedFile } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { LocationCascade } from "@/components/shared/location-cascade";
import { toast } from "@/components/ui/toast";
import { blockNameSchema } from "@/lib/validation/common";
import { formatDate } from "@/lib/utils";
import { levelNeedsInChargeTerms } from "@/lib/terms/documents";
import { TermsReader, type TermsProp } from "@/components/site/terms-reader";
import { InChargeDeclaration, VolunteerTeacherDeclaration } from "@/components/site/terms-declarations";

type Level = "BLOCK" | "DISTRICT" | "STATE";
interface DocType {
  key: string;
  name: string;
  description: string | null;
  isRequired: boolean;
}
interface Course {
  id: string;
  name: string;
  code: string;
}
interface Submitted {
  id: string;
  applicationNo: string;
  uploadToken: string;
}

interface FormState {
  /** Terms versions that were on screen when each box was ticked; accepted only while they are the current ones. */
  volunteerTermsVersion: string | null;
  inChargeTermsVersion: string | null;
  name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  dob: string;
  gender: string;
  level: Level | "";
  stateId?: string;
  districtId?: string;
  /** Set when the block was picked from (or typed exactly as) one of the district's blocks. */
  blockId?: string;
  /** The block as typed; the server finds it in the district or adds it. */
  blockName?: string;
  address: string;
  pincode: string;
  qualification: string;
  skills: string[];
  experienceYears: string;
  teachingExperienceYears: string;
  preferredCourseIds: string[];
  languages: string[];
  availability: string;
  trainingMode: "OFFLINE" | "ONLINE" | "HYBRID";
  motivation: string;
  acceptTerms: boolean;
}

const INITIAL: FormState = {
  volunteerTermsVersion: null,
  inChargeTermsVersion: null,
  name: "",
  mobile: "",
  whatsapp: "",
  email: "",
  dob: "",
  gender: "",
  level: "",
  address: "",
  pincode: "",
  qualification: "",
  skills: [],
  experienceYears: "0",
  teachingExperienceYears: "0",
  preferredCourseIds: [],
  languages: [],
  availability: "",
  trainingMode: "OFFLINE",
  motivation: "",
  acceptTerms: false,
};

const STEPS = [
  { label: "Terms", description: "Read and accept first" },
  { label: "Personal", description: "Contact details" },
  { label: "Level", description: "Block / District / State" },
  { label: "Location", description: "Where you will serve" },
  { label: "Professional", description: "Skills & experience" },
  { label: "Motivation", description: "Why you volunteer" },
  { label: "Documents", description: "Upload after submit" },
];

/** Wizard step indexes. Documents comes after Submit, so Motivation is the last step of the form itself. */
const STEP = { terms: 0, personal: 1, level: 2, location: 3, professional: 4, motivation: 5, documents: 6 } as const;

const STEP_FIELDS: string[][] = [
  ["acceptVolunteerTerms", "volunteerTermsVersion"],
  ["name", "mobile", "whatsapp", "email", "dob", "gender"],
  ["level", "acceptInChargeTerms", "inChargeTermsVersion"],
  ["stateId", "districtId", "blockId", "blockName", "address", "pincode"],
  ["qualification", "skills", "experienceYears", "teachingExperienceYears", "preferredCourseIds", "languages", "availability", "trainingMode"],
  ["motivation", "acceptTerms"],
];

const PIN_RE = /^[1-9]\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = "esk.trainerApplication";

function depthFor(level: Level | ""): "state" | "district" | "block" {
  return level === "STATE" ? "state" : level === "DISTRICT" ? "district" : "block";
}

/** Picked from the list, or typed — a typed block must pass the same rule the server applies. */
function blockFieldIssue(f: FormState): string | null {
  if (f.blockId) return null;
  if (!f.blockName?.trim()) return "Select or type your block";
  const parsed = blockNameSchema.safeParse(f.blockName);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Enter your block name");
}

interface TermsVersions {
  volunteer: string;
  inCharge: string;
}

function validateStep(step: number, f: FormState, terms: TermsVersions): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === STEP.terms && f.volunteerTermsVersion !== terms.volunteer) {
    e.acceptVolunteerTerms = "Read the Volunteer Teacher Terms & Conditions to the end and tick the box to accept them";
  }
  if (step === STEP.personal) {
    if (f.name.trim().length < 2) e.name = "Enter your full name";
    const mobileIssue = phoneIssue(f.mobile);
    if (mobileIssue) e.mobile = mobileIssue;
    const whatsappIssue = f.whatsapp.trim() ? phoneIssue(f.whatsapp) : null;
    if (whatsappIssue) e.whatsapp = whatsappIssue;
    if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address";
    if (!f.dob) e.dob = "Enter your date of birth";
    else if (new Date(f.dob) > new Date()) e.dob = "Date of birth cannot be in the future";
    if (!f.gender) e.gender = "Select your gender";
  }
  if (step === STEP.level) {
    if (!f.level) e.level = "Choose the level you want to volunteer at";
    else if (levelNeedsInChargeTerms(f.level) && f.inChargeTermsVersion !== terms.inCharge) {
      e.acceptInChargeTerms = "Block and District level volunteers must read the In-Charge terms to the end and accept them";
    }
  }
  if (step === STEP.location) {
    if (!f.stateId) e.stateId = "Select your state";
    if ((f.level === "DISTRICT" || f.level === "BLOCK") && !f.districtId) e.districtId = "Select your district";
    if (f.level === "BLOCK") {
      const blockIssue = blockFieldIssue(f);
      if (blockIssue) e.blockId = blockIssue;
    }
    if (f.address.trim().length < 5) e.address = "Enter your address";
    if (!PIN_RE.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit PIN code";
  }
  if (step === STEP.professional) {
    if (f.qualification.trim().length < 2) e.qualification = "Enter your highest qualification";
    if (f.skills.length === 0) e.skills = "Add at least one skill you can teach";
    const exp = Number(f.experienceYears);
    const texp = Number(f.teachingExperienceYears);
    if (!Number.isInteger(exp) || exp < 0 || exp > 60) e.experienceYears = "Enter years between 0 and 60";
    if (!Number.isInteger(texp) || texp < 0 || texp > 60) e.teachingExperienceYears = "Enter years between 0 and 60";
    if (f.languages.length === 0) e.languages = "Add at least one language";
  }
  if (step === STEP.motivation) {
    if (f.motivation.trim().length < 30) e.motivation = "Please write at least a few sentences (30+ characters)";
    if (!f.acceptTerms) e.acceptTerms = "You must accept the declaration to continue";
  }
  return e;
}

/** Every step up to `upto`, so Submit never sends a form with an earlier step left incomplete. */
function validateThrough(upto: number, f: FormState, terms: TermsVersions): { step: number; errors: Record<string, string> } | null {
  for (let s = 0; s <= upto; s++) {
    const errors = validateStep(s, f, terms);
    if (Object.keys(errors).length) return { step: s, errors };
  }
  return null;
}

export function TrainerApplyForm({
  documentTypes,
  volunteerTerms,
  inChargeTerms,
}: {
  documentTypes: DocType[];
  /** The Volunteer Teacher Terms & Conditions, read and accepted before the form (every level). */
  volunteerTerms: TermsProp;
  /** The Block / District In-Charge terms, accepted on the Level step by Block and District level applicants. */
  inChargeTerms: TermsProp;
}) {
  const router = useRouter();
  const termsVersions: TermsVersions = { volunteer: volunteerTerms.version, inCharge: inChargeTerms.version };
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [submitted, setSubmitted] = React.useState<Submitted | null>(null);
  const [done, setDone] = React.useState(false);
  const [photo, setPhoto] = React.useState<UploadedFile | null>(null);
  const [docs, setDocs] = React.useState<Record<string, UploadedFile | null>>({});
  const [names, setNames] = React.useState<{ state?: string; district?: string; block?: string }>({});
  const topRef = React.useRef<HTMLDivElement>(null);

  /** LocationCascade re-emits names on every render; keep the previous object when nothing changed. */
  const handleNames = React.useCallback((n: { state?: string; district?: string; block?: string }) => {
    setNames((prev) => (prev.state === n.state && prev.district === n.district && prev.block === n.block ? prev : n));
  }, []);

  React.useEffect(() => {
    api
      .get<{ courses: Course[] }>("/api/public/courses")
      .then((d) => setCourses(d.courses))
      .catch(() => setCourses([]));
    // Restore an in-progress document upload step (survives a refresh). Deferred so state is not written synchronously in the effect.
    const restore = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Submitted & { docs?: Record<string, UploadedFile | null>; photo?: UploadedFile | null };
        if (saved?.id && saved?.uploadToken) {
          setSubmitted({ id: saved.id, applicationNo: saved.applicationNo, uploadToken: saved.uploadToken });
          setDocs(saved.docs ?? {});
          setPhoto(saved.photo ?? null);
          setStep(STEP.documents);
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(restore);
  }, []);

  const persist = React.useCallback((s: Submitted | null, d: Record<string, UploadedFile | null>, p: UploadedFile | null) => {
    try {
      if (!s) sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, docs: d, photo: p }));
    } catch {
      /* ignore */
    }
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

  const next = () => {
    const e = validateStep(step, form, termsVersions);
    setErrors(e);
    if (Object.keys(e).length) return;
    // A step that validates has dealt with whatever the last submit reported (e.g. updated terms).
    setFormError(null);
    setStep((s) => Math.min(s + 1, STEP.motivation));
    scrollTop();
  };
  const back = () => {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  const submit = async () => {
    const invalid = validateThrough(STEP.motivation, form, termsVersions);
    if (invalid) {
      setErrors(invalid.errors);
      setStep(invalid.step);
      scrollTop();
      return;
    }
    setErrors({});
    const needsInCharge = levelNeedsInChargeTerms(form.level);
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        whatsapp: form.whatsapp.trim() || "",
        email: form.email.trim(),
        dob: form.dob,
        gender: form.gender,
        level: form.level,
        stateId: form.stateId,
        districtId: form.level === "STATE" ? "" : (form.districtId ?? ""),
        // A picked block travels by id alone (its stored name may use characters a typed name may
        // not); a typed one by name, which the server finds in the district or adds to it.
        blockId: form.level === "BLOCK" ? (form.blockId ?? "") : "",
        blockName: form.level === "BLOCK" && !form.blockId ? (form.blockName?.trim() ?? "") : "",
        address: form.address.trim(),
        pincode: form.pincode.trim(),
        qualification: form.qualification.trim(),
        skills: form.skills,
        experienceYears: Number(form.experienceYears),
        teachingExperienceYears: Number(form.teachingExperienceYears),
        preferredCourseIds: form.preferredCourseIds,
        languages: form.languages,
        availability: form.availability.trim() || "",
        trainingMode: form.trainingMode,
        motivation: form.motivation.trim(),
        acceptTerms: form.acceptTerms,
        acceptVolunteerTerms: form.volunteerTermsVersion === volunteerTerms.version,
        volunteerTermsVersion: form.volunteerTermsVersion ?? "",
        acceptInChargeTerms: needsInCharge ? form.inChargeTermsVersion === inChargeTerms.version : undefined,
        inChargeTermsVersion: needsInCharge ? (form.inChargeTermsVersion ?? "") : undefined,
      };
      const data = await api.post<Submitted>("/api/public/trainer-applications", payload);
      setSubmitted(data);
      persist(data, {}, null);
      setStep(STEP.documents);
      scrollTop();
      toast.success("Application submitted", `Your application number is ${data.applicationNo}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 422) {
          const fe = err.fieldErrors;
          if (fe.acceptVolunteerTerms || fe.acceptInChargeTerms) {
            // A text was edited while this form was open: drop that acceptance and load the new text.
            setForm((f) => ({
              ...f,
              volunteerTermsVersion: fe.acceptVolunteerTerms ? null : f.volunteerTermsVersion,
              inChargeTermsVersion: fe.acceptInChargeTerms ? null : f.inChargeTermsVersion,
            }));
            router.refresh();
          }
          setErrors(fe);
          const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => fe[f]));
          if (firstStep >= 0) setStep(firstStep);
          setFormError(err.message);
        } else if (err.status === 409) {
          setFormError(
            <>
              {err.message}{" "}
              <Link href="/become-a-trainer/status" className="font-semibold underline underline-offset-2">
                Track your application
              </Link>
              .
            </>
          );
        } else setFormError(err.message);
      } else setFormError("Unable to submit your application. Please try again.");
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    setDone(true);
    persist(null, {}, null);
    scrollTop();
  };

  const startNew = () => {
    persist(null, {}, null);
    setSubmitted(null);
    setDone(false);
    setDocs({});
    setPhoto(null);
    setForm(INITIAL);
    setStep(STEP.terms);
  };

  const depth = depthFor(form.level);
  const requiredMissing = documentTypes.filter((d) => d.isRequired && !docs[d.key]);

  if (done && submitted) {
    return (
      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-24">
        <Card>
          <CardBody className="card-p text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success-dark">
              <CheckCircle2 className="h-9 w-9" aria-hidden />
            </div>
            <h2 className="mt-5 text-h2">Thank you for volunteering!</h2>
            <p className="mx-auto mt-2 max-w-lg text-body text-muted">Your application has been received. Save your application number — you will need it, along with your registered mobile number, to track progress.</p>
            <p className="mt-6 text-overline text-muted">Application number</p>
            <p className="mt-1 font-heading text-h1 tracking-wide text-orange">{submitted.applicationNo}</p>
            <div className="mt-8 text-left">
              <h3 className="mb-4 text-h4 text-navy">What happens next</h3>
              <Timeline
                items={[
                  { title: "Under review", description: "Our trainer team reviews your profile, skills and preferred courses.", tone: "orange" },
                  { title: "Document verification", description: "We verify your resume, qualification and identity documents. We may ask for more documents.", tone: "navy" },
                  { title: "Interview (if required)", description: "A short conversation on phone or video call about your experience and availability.", tone: "navy" },
                  { title: "Approval", description: "Once verified, your application is approved by the Foundation.", tone: "navy" },
                  { title: "Trainer ID & portal access", description: "You receive your Trainer ID and login details for the Trainer Portal.", tone: "success" },
                ]}
              />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <ButtonLink href={`/become-a-trainer/status?no=${encodeURIComponent(submitted.applicationNo)}`} variant="navy" leftIcon={<Search className="h-4 w-4" />} fullWidth className="sm:w-auto">
                Track application status
              </ButtonLink>
              <ButtonLink href="/" variant="outline" fullWidth className="sm:w-auto">
                Back to home
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const formId = "trainer-apply-form";
  const onDocuments = step === STEP.documents && submitted !== null;
  const needsInChargeTerms = levelNeedsInChargeTerms(form.level);
  const designation = form.level === "BLOCK" ? "Block In-Charge" : form.level === "DISTRICT" ? "District In-Charge" : null;
  const clearError = (key: string) =>
    setErrors((e) => {
      if (!e[key]) return e;
      const rest = { ...e };
      delete rest[key];
      return rest;
    });

  return (
    <div ref={topRef} className="mx-auto max-w-4xl scroll-mt-24">
      {/* Same frame as the centre application: sticky WizardProgress under the app bar and a
          StickyActionBar footer, so the two public application flows are one experience on a phone
          instead of two. The footer's Next is a submit button bound to the form by id. */}
      <WizardShell
        steps={STEPS}
        current={step}
        onBack={step > 0 && !onDocuments ? back : undefined}
        nextType={onDocuments ? "button" : "submit"}
        onNext={onDocuments ? finish : undefined}
        form={onDocuments ? undefined : formId}
        nextLabel={onDocuments ? (requiredMissing.length ? "Finish for now" : "Finish") : step === STEP.motivation ? "Submit application" : "Continue"}
        nextLoading={submitting}
      >
        {formError && (
          <Alert tone="danger" className="mb-5">
            {formError}
          </Alert>
        )}

        {onDocuments && submitted ? (
        <Card>
          <CardHeader title="Upload your documents" description={`Application ${submitted.applicationNo} · Files are stored privately and only seen by the Foundation's trainer team.`} />
          <CardBody className="space-y-6">
            <Alert tone="info">Uploads are optional right now. You can also add documents later from the application status page using your application number and mobile number.</Alert>
            <FormSection title="Passport photo" description="A recent, clear photo (JPG/PNG, up to 2 MB). Used on your trainer ID.">
              <FileUpload
                endpoint={`/api/public/trainer-applications/${submitted.id}/photo`}
                fields={{ token: submitted.uploadToken }}
                accept=".jpg,.jpeg,.png"
                maxSizeMb={2}
                value={photo}
                onChange={(f) => {
                  setPhoto(f);
                  persist(submitted, docs, f);
                }}
                label="Upload photo"
                preview={false}
              />
            </FormSection>
            <FormSection title="Supporting documents" description="PDF or image files up to 5 MB each. Resume may be PDF or Word.">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {documentTypes.map((d) => (
                  <div key={d.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-body font-semibold text-ink">{d.name}</p>
                      <Badge tone={d.isRequired ? "orange" : "neutral"}>{d.isRequired ? "Required" : "Optional"}</Badge>
                    </div>
                    {d.description && <p className="text-body-sm text-muted">{d.description}</p>}
                    <FileUpload
                      endpoint={`/api/public/trainer-applications/${submitted.id}/documents`}
                      fields={{ token: submitted.uploadToken, type: d.key }}
                      accept={d.key === "resume" ? ".pdf,.doc,.docx" : ".jpg,.jpeg,.png,.pdf"}
                      maxSizeMb={5}
                      value={docs[d.key] ?? null}
                      onChange={(f) => {
                        const nextDocs = { ...docs, [d.key]: f };
                        setDocs(nextDocs);
                        persist(submitted, nextDocs, photo);
                      }}
                      label={`Upload ${d.name.toLowerCase()}`}
                      preview={false}
                    />
                  </div>
                ))}
              </div>
            </FormSection>
            {requiredMissing.length > 0 && (
              <Alert tone="warning" title="Some required documents are still missing">
                {requiredMissing.map((d) => d.name).join(", ")}. Your application will be marked &ldquo;Documents required&rdquo; until they are uploaded. You can finish now and upload later.
              </Alert>
            )}
            {/* Finish lives in the wizard's sticky footer; only the secondary escape hatch is here. */}
            <div className="border-t border-line pt-5">
              <button type="button" onClick={startNew} className="inline-flex min-h-11 items-center rounded-md text-body-sm font-semibold text-muted underline-offset-4 ring-focus hover:text-navy hover:underline">
                Start a new application
              </button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="card-p sm:p-8">
            <form
              id={formId}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (step < STEP.motivation) next();
                else void submit();
              }}
            >
              {step === STEP.terms && (
                <FormSection
                  title="Read the terms before you apply"
                  description="Every volunteer trainer and teacher with EduSkill India Foundation agrees to these terms. Read them to the end and tick the box to accept them — the application form opens after that."
                >
                  {/* Keyed by version: when the terms change under an open form, the reader starts again. */}
                  <TermsReader
                    key={volunteerTerms.version}
                    terms={volunteerTerms}
                    checkboxLabel="I have read and understood the Volunteer Teacher Terms & Conditions, and I agree to follow them."
                    accepted={form.volunteerTermsVersion === volunteerTerms.version}
                    onAcceptedChange={(v) => {
                      // Ticked against the text on screen now; a newer text after a refresh unticks it.
                      setForm((f) => ({ ...f, volunteerTermsVersion: v ? volunteerTerms.version : null }));
                      clearError("acceptVolunteerTerms");
                    }}
                    error={errors.acceptVolunteerTerms}
                  />
                </FormSection>
              )}

              {step === STEP.personal && (
                <FormSection title="Personal details" description="We use these to contact you about your application.">
                  <FormGrid>
                    <Field label="Full name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
                      <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoComplete="name" />
                    </Field>
                    <Field label="Mobile number" htmlFor="mobile" required error={errors.mobile} hint="Used to track your application. Pick your country if it is not India.">
                      <PhoneInput id="mobile" value={form.mobile} onChange={(v) => set("mobile", v)} invalid={!!errors.mobile} />
                    </Field>
                    <Field label="WhatsApp number" htmlFor="whatsapp" error={errors.whatsapp} hint="Leave blank if same as mobile.">
                      <PhoneInput id="whatsapp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} invalid={!!errors.whatsapp} />
                    </Field>
                    <Field label="Email address" htmlFor="email" required error={errors.email}>
                      <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} autoComplete="email" />
                    </Field>
                    <Field label="Date of birth" htmlFor="dob" required error={errors.dob}>
                      <Input id="dob" type="date" value={form.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("dob", e.target.value)} invalid={!!errors.dob} />
                    </Field>
                    <Field label="Gender" htmlFor="gender" required error={errors.gender}>
                      <Select id="gender" value={form.gender} onChange={(e) => set("gender", e.target.value)} placeholder="Select gender" invalid={!!errors.gender} options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} />
                    </Field>
                  </FormGrid>
                  <p className="text-body-sm text-muted">You will be able to upload a passport photo and your documents right after submitting.</p>
                </FormSection>
              )}

              {step === STEP.level && (
                <FormSection title="Volunteer level" description="Choose the geography you would like to serve. This decides which location details we ask for next.">
                  <Field error={errors.level}>
                    <RadioCards
                      name="level"
                      value={form.level || undefined}
                      onChange={(v) => {
                        const lvl = v as Level;
                        setForm((f) => ({
                          ...f,
                          level: lvl,
                          districtId: lvl === "STATE" ? undefined : f.districtId,
                          blockId: lvl === "BLOCK" ? f.blockId : undefined,
                          blockName: lvl === "BLOCK" ? f.blockName : undefined,
                        }));
                        setErrors((e) => {
                          const n = { ...e };
                          delete n.level;
                          return n;
                        });
                      }}
                      options={[
                        { value: "BLOCK", label: "Block Level", description: "Teach at training centers within one block. Ideal for local volunteers who can visit a center regularly." },
                        { value: "DISTRICT", label: "District Level", description: "Support multiple centers across a district, including training and mentoring other trainers." },
                        { value: "STATE", label: "State Level", description: "Master trainers who guide the programme across a whole state and lead trainer development." },
                      ]}
                    />
                  </Field>
                  {needsInChargeTerms && (
                    <div className="space-y-3 border-t border-line pt-5">
                      <div>
                        <h3 className="text-h4 text-navy">{designation} terms</h3>
                        <p className="mt-0.5 text-body-sm text-muted">
                          Block and District level volunteers act as the Foundation&rsquo;s In-Charge in their area. Read these terms to the end and accept them to continue.
                          {form.level === "BLOCK" && " They are written for the District In-Charge and apply in the same way to a Block In-Charge."}
                        </p>
                      </div>
                      <TermsReader
                        key={inChargeTerms.version}
                        terms={inChargeTerms}
                        checkboxLabel="I have read and understood the In-Charge Terms, Roles & Conditions, and I agree to follow them."
                        accepted={form.inChargeTermsVersion === inChargeTerms.version}
                        onAcceptedChange={(v) => {
                          setForm((f) => ({ ...f, inChargeTermsVersion: v ? inChargeTerms.version : null }));
                          clearError("acceptInChargeTerms");
                        }}
                        error={errors.acceptInChargeTerms}
                      />
                    </div>
                  )}
                </FormSection>
              )}

              {step === STEP.location && (
                <FormSection title="Location" description={form.level === "STATE" ? "Select the state you will serve." : form.level === "DISTRICT" ? "Select your state and district." : "Select your state and district, then pick or type your block."}>
                  <LocationCascade
                    value={{ stateId: form.stateId, districtId: form.districtId, blockId: form.blockId, blockName: form.blockName }}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, stateId: v.stateId, districtId: v.districtId, blockId: v.blockId, blockName: v.blockName }));
                      setErrors((e) => {
                        const n = { ...e };
                        delete n.stateId;
                        delete n.districtId;
                        delete n.blockId;
                        delete n.blockName;
                        return n;
                      });
                    }}
                    onNames={handleNames}
                    depth={depth}
                    required
                    errors={{ stateId: errors.stateId, districtId: errors.districtId, blockId: errors.blockId, blockName: errors.blockName }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                  />
                  <FormGrid>
                    <Field label="Address" htmlFor="address" required error={errors.address} className="sm:col-span-2">
                      <Textarea id="address" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} invalid={!!errors.address} />
                    </Field>
                    <Field label="PIN code" htmlFor="pincode" required error={errors.pincode}>
                      <Input id="pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} invalid={!!errors.pincode} />
                    </Field>
                  </FormGrid>
                </FormSection>
              )}

              {step === STEP.professional && (
                <FormSection title="Professional background" description="Tell us what you can teach and when you are available.">
                  <FormGrid>
                    <Field label="Highest qualification" htmlFor="qualification" required error={errors.qualification} className="sm:col-span-2">
                      <Input id="qualification" value={form.qualification} onChange={(e) => set("qualification", e.target.value)} invalid={!!errors.qualification} placeholder="e.g. B.Sc Computer Science, ITI Electrician" />
                    </Field>
                    <Field label="Skills you can teach" required error={errors.skills} hint="Type a skill and press Enter." className="sm:col-span-2">
                      <TagInput value={form.skills} onChange={(v) => set("skills", v)} placeholder="e.g. MS Office, Tailoring, Spoken English" />
                    </Field>
                    <Field label="Total work experience (years)" htmlFor="experienceYears" required error={errors.experienceYears}>
                      <Input id="experienceYears" type="number" min={0} max={60} value={form.experienceYears} onChange={(e) => set("experienceYears", e.target.value)} invalid={!!errors.experienceYears} />
                    </Field>
                    <Field label="Teaching / training experience (years)" htmlFor="teachingExperienceYears" required error={errors.teachingExperienceYears}>
                      <Input id="teachingExperienceYears" type="number" min={0} max={60} value={form.teachingExperienceYears} onChange={(e) => set("teachingExperienceYears", e.target.value)} invalid={!!errors.teachingExperienceYears} />
                    </Field>
                    <Field label="Preferred courses" hint="Select the courses you would like to teach." className="sm:col-span-2">
                      {courses.length === 0 ? (
                        <p className="text-body text-muted">Loading courses…</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 rounded-card border border-line p-4 sm:grid-cols-2">
                          {courses.map((c) => (
                            <Checkbox
                              key={c.id}
                              label={c.name}
                              description={c.code}
                              checked={form.preferredCourseIds.includes(c.id)}
                              onChange={(e) => set("preferredCourseIds", e.target.checked ? [...form.preferredCourseIds, c.id] : form.preferredCourseIds.filter((id) => id !== c.id))}
                            />
                          ))}
                        </div>
                      )}
                    </Field>
                    <Field label="Languages you can teach in" required error={errors.languages} hint="Type a language and press Enter." className="sm:col-span-2">
                      <TagInput value={form.languages} onChange={(v) => set("languages", v)} placeholder="e.g. Hindi, Bengali, English" />
                    </Field>
                    <Field label="Availability" htmlFor="availability" hint="Days and hours you can volunteer.">
                      <Input id="availability" value={form.availability} onChange={(e) => set("availability", e.target.value)} placeholder="e.g. Weekday mornings, weekends" />
                    </Field>
                    <Field label="Preferred training mode" htmlFor="trainingMode" required>
                      <Select id="trainingMode" value={form.trainingMode} onChange={(e) => set("trainingMode", e.target.value as FormState["trainingMode"])} options={[{ value: "OFFLINE", label: "Offline (at a center)" }, { value: "ONLINE", label: "Online" }, { value: "HYBRID", label: "Hybrid" }]} />
                    </Field>
                  </FormGrid>
                </FormSection>
              )}

              {step === STEP.motivation && (
                <FormSection title="Motivation & declaration">
                  <Field label="Why do you want to become a volunteer trainer?" htmlFor="motivation" required error={errors.motivation} hint={`${form.motivation.trim().length} / 3000 characters (minimum 30)`}>
                    <Textarea id="motivation" rows={6} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} invalid={!!errors.motivation} />
                  </Field>
                  <VolunteerTeacherDeclaration
                    gender={form.gender}
                    values={{ name: form.name, mobile: form.mobile, address: [form.address, form.pincode].map((v) => v.trim()).filter(Boolean).join(", "), date: formatDate(new Date()) }}
                    signature="Accepted online — pressing Submit application records your acceptance with the date and time."
                  />
                  {needsInChargeTerms && (
                    <InChargeDeclaration
                      gender={form.gender}
                      values={{
                        name: form.name,
                        designation,
                        district: names.district ?? null,
                        state: names.state ?? null,
                        mobile: form.mobile,
                        email: form.email,
                        date: formatDate(new Date()),
                        place: names.block || form.blockName?.trim() || names.district || null,
                      }}
                      signature="Accepted online — pressing Submit application records your acceptance with the date and time."
                    />
                  )}
                  <Field error={errors.acceptTerms}>
                    <Checkbox
                      checked={form.acceptTerms}
                      onChange={(e) => set("acceptTerms", e.target.checked)}
                      label="I declare that the information provided is true and complete."
                      description="I understand that this is a voluntary role, that the Foundation may verify my documents and contact my references, and that false information may lead to rejection."
                    />
                  </Field>
                </FormSection>
              )}

            </form>
          </CardBody>
        </Card>
      )}
      </WizardShell>
      <p className="mt-6 text-center text-body-sm text-muted">
        Already applied?{" "}
        <Link href="/become-a-trainer/status" className="font-semibold text-orange underline-offset-4 ring-focus hover:underline">
          Track your application status
        </Link>
      </p>
    </div>
  );
}
