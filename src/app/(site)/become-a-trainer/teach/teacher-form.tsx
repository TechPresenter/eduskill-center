"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Search, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { phoneIssue } from "@/lib/phone";
import { withBasePath } from "@/lib/base-path";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, CheckboxCards, Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { ErrorSummary, type ErrorSummaryItem } from "@/components/ui/error-summary";
import { Timeline } from "@/components/ui/misc";
import { TagInput } from "@/components/ui/file-upload";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { DistrictCombobox, type DistrictOption } from "@/components/shared/district-combobox";
import { toast } from "@/components/ui/toast";
import { TermsReader, type TermsProp } from "@/components/site/terms-reader";
import {
  TEACHING_CLASS_BANDS,
  TEACHING_CLASS_LABEL,
  TEACHING_EXPERIENCE_BANDS,
  TEACHING_EXPERIENCE_LABEL,
  TEACHING_MODES,
  TEACHING_MODE_LABEL,
  type TeachingClassBand,
} from "@/lib/validation/trainers";

const RESUME_ACCEPT = ".pdf,.doc,.docx";
const RESUME_MAX_MB = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Suggestions only — the control is a free-text input, so an unlisted qualification still fits. */
const QUALIFICATIONS = ["B.A.", "B.Sc.", "B.Com.", "B.Tech / B.E.", "B.Ed.", "D.El.Ed.", "M.A.", "M.Sc.", "M.Com.", "M.Tech / M.E.", "M.Ed.", "Ph.D.", "Diploma", "ITI"];

const CLASS_DESCRIPTIONS: Record<TeachingClassBand, string> = {
  CLASS_1_4: "Primary — foundational literacy and numeracy",
  CLASS_5_10: "Middle and secondary school subjects",
  CLASS_11_12: "Senior secondary streams",
  COMPETITIVE_EXAMS: "Entrance and government exam coaching",
};

interface FormState {
  name: string;
  mobile: string;
  email: string;
  qualification: string;
  subjects: string[];
  classes: TeachingClassBand[];
  experienceBand: string;
  teachingMode: string;
  consent: boolean;
}

const INITIAL: FormState = {
  name: "",
  mobile: "",
  email: "",
  qualification: "",
  subjects: [],
  classes: [],
  experienceBand: "",
  teachingMode: "",
  consent: false,
};

interface Submitted {
  applicationNo: string;
  district: string;
}

/** The id the error summary jumps to for each field. */
const FIELD_IDS = {
  name: "t-name",
  mobile: "t-mobile",
  email: "t-email",
  districtId: "t-district",
  qualification: "t-qualification",
  subjects: "t-subjects",
  classes: "t-classes",
  experienceBand: "t-experience",
  teachingMode: "t-mode",
  resume: "t-resume",
  consent: "t-consent",
} as const satisfies Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  name: "Full name",
  mobile: "Mobile number",
  email: "Email address",
  districtId: "City / District",
  qualification: "Highest qualification",
  subjects: "Subjects you can teach",
  classes: "Classes you can teach",
  experienceBand: "Teaching experience",
  teachingMode: "Teaching mode",
  resume: "Resume / CV",
  consent: "Declaration",
};

/**
 * The ids `<Field>` gives its hint and error messages, for the three composite controls it cannot
 * wire automatically (`autoWire={false}`). Field derives them from the control id it was handed,
 * so they are predictable: `<id>-hint` and `<id>-error`.
 */
function describedBy(id: string, hasHint: boolean, hasError: boolean) {
  return [hasHint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

/** The same rules the server enforces in `teacherApplicationSchema`; the server is still the authority. */
function validate(f: FormState, district: DistrictOption | null, resume: File | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.name.trim().length < 2) e.name = "Enter your full name";
  const mobileIssue = phoneIssue(f.mobile);
  if (mobileIssue) e.mobile = mobileIssue;
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!district) e.districtId = "Pick your city or district from the list";
  if (f.qualification.trim().length < 2) e.qualification = "Enter your highest qualification";
  if (f.subjects.length === 0) e.subjects = "Add at least one subject you can teach";
  if (f.classes.length === 0) e.classes = "Select at least one class group";
  if (!f.experienceBand) e.experienceBand = "Select your teaching experience";
  if (!f.teachingMode) e.teachingMode = "Select your preferred teaching mode";
  if (!resume) e.resume = "Attach your resume or CV (PDF, DOC or DOCX, up to 5 MB)";
  if (!f.consent) e.consent = "You must agree before submitting";
  return e;
}

const TERMS_REQUIRED = "Read the Volunteer Teacher Terms & Conditions to the end and tick the box to accept them";

/**
 * `terms`: the Volunteer Teacher Terms & Conditions. They are read and accepted on a first screen;
 * the form itself opens only after that (and closes again if the server reports a newer text).
 */
export function TeacherApplyForm({ terms }: { terms: TermsProp }) {
  const router = useRouter();
  /** The terms version that was on screen when the box was ticked; accepted only while it is the current one. */
  const [acceptedTermsVersion, setAcceptedTermsVersion] = React.useState<string | null>(null);
  const [termsDone, setTermsDone] = React.useState(false);
  const [termsError, setTermsError] = React.useState<string | null>(null);
  const termsAccepted = acceptedTermsVersion === terms.version;
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [district, setDistrict] = React.useState<DistrictOption | null>(null);
  const [resume, setResume] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<React.ReactNode>(null);
  const [failures, setFailures] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<Submitted | null>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key as string);
  };

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });

  /** Back to the terms screen, at its top — the form above it was longer, so the page would sit on the footer. */
  const reopenTerms = () => {
    setTermsDone(false);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const continueToForm = () => {
    if (!termsAccepted) {
      setTermsError(TERMS_REQUIRED);
      return;
    }
    setTermsError(null);
    setTermsDone(true);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!termsAccepted) {
      setTermsError(TERMS_REQUIRED);
      reopenTerms();
      return;
    }
    const e = validate(form, district, resume);
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) {
      setFailures((n) => n + 1);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("mobile", form.mobile.trim());
      fd.append("email", form.email.trim());
      fd.append("districtId", district!.id);
      fd.append("qualification", form.qualification.trim());
      for (const s of form.subjects) fd.append("subjects", s);
      for (const c of form.classes) fd.append("classes", c);
      fd.append("experienceBand", form.experienceBand);
      fd.append("teachingMode", form.teachingMode);
      fd.append("consent", "true");
      fd.append("acceptVolunteerTerms", "true");
      fd.append("volunteerTermsVersion", acceptedTermsVersion ?? "");
      fd.append("resume", resume!);
      const data = await api.post<Submitted>("/api/public/teacher-applications", fd);
      setSubmitted(data);
      toast.success("Application submitted", `Your application number is ${data.applicationNo}`);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 422 && err.fieldErrors.acceptVolunteerTerms) {
          // The terms were edited while this form was open: back to the first screen with the new text.
          setAcceptedTermsVersion(null);
          setTermsError(err.fieldErrors.acceptVolunteerTerms);
          reopenTerms();
          router.refresh();
        } else if (err.status === 422) {
          setErrors(err.fieldErrors);
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
      setFailures((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-24">
        <Card>
          <CardBody className="card-p text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success-dark">
              <CheckCircle2 className="h-9 w-9" aria-hidden />
            </div>
            <h2 className="mt-5 text-h2">Application received</h2>
            <p className="mx-auto mt-2 max-w-lg text-body text-muted">
              Thank you for offering to teach with EduSkill. Save your application number — you will need it, together with the mobile number you gave, to track progress.
            </p>
            <p className="mt-6 text-overline text-muted">Application number</p>
            <p className="mt-1 font-heading text-h1 tracking-wide text-orange">{submitted.applicationNo}</p>
            <p className="mt-2 text-body-sm text-muted">Registered for {submitted.district}</p>
            <div className="mt-8 text-left">
              <h3 className="mb-4 text-h4 text-navy">What happens next</h3>
              <Timeline
                items={[
                  { title: "Screening", description: "Our trainer team reads your resume and the subjects and classes you offered.", tone: "orange" },
                  { title: "Document verification", description: "We verify your qualification and identity. We may ask for a few more documents.", tone: "navy" },
                  { title: "Interview (if required)", description: "A short conversation on phone or video about your experience and availability.", tone: "navy" },
                  { title: "Approval", description: "Once verified, the Foundation approves your application.", tone: "navy" },
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

  // Listed in form order (the key order of FIELD_IDS), so the summary reads top to bottom.
  const summaryItems: ErrorSummaryItem[] = (Object.entries(FIELD_IDS) as [keyof typeof FIELD_IDS, string][])
    .filter(([key]) => errors[key])
    .map(([key, id]) => ({ id, message: `${FIELD_LABELS[key] ?? key}: ${errors[key]}` }));

  if (!termsDone) {
    return (
      <div ref={topRef} className="mx-auto max-w-4xl scroll-mt-24">
        <Card>
          <CardBody className="card-p space-y-5 sm:p-8">
            <div>
              <p className="text-overline text-orange">Step 1 of 2</p>
              <h2 className="mt-1 text-h3 text-navy">Read the terms before you apply</h2>
              <p className="mt-1 text-body text-muted">
                Every volunteer teacher with EduSkill India Foundation agrees to these terms. Read them to the end and tick the box to accept them — the application form opens after that.
              </p>
            </div>
            {/* Keyed by version: when the terms change, the reader starts again. */}
            <TermsReader
              key={terms.version}
              terms={terms}
              checkboxLabel="I have read and understood the Volunteer Teacher Terms & Conditions, and I agree to follow them."
              accepted={termsAccepted}
              onAcceptedChange={(v) => {
                setAcceptedTermsVersion(v ? terms.version : null);
                setTermsError(null);
              }}
              error={termsError ?? undefined}
            />
            <div className="border-t border-line pt-6">
              <Button type="button" size="lg" fullWidth onClick={continueToForm} rightIcon={<ArrowRight className="h-4 w-4" />} className="sm:w-auto sm:min-w-64">
                Continue to the application
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div ref={topRef} className="mx-auto max-w-4xl scroll-mt-24">
      <Alert
        tone="success"
        className="mb-5 items-center"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={reopenTerms} className="shrink-0">
            Read them again
          </Button>
        }
      >
        <span className="font-semibold">Step 2 of 2.</span> You accepted the Volunteer Teacher Terms &amp; Conditions.
      </Alert>
      <form noValidate onSubmit={submit}>
        <Card>
          <CardBody className="card-p space-y-6 sm:p-8">
            {(summaryItems.length > 0 || formError) && <ErrorSummary errors={summaryItems} message={formError} focusSignal={failures} />}

            {/* Two columns from md up, one below. Every wide control opts out with md:col-span-2. */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Full name" htmlFor={FIELD_IDS.name} required error={errors.name}>
                <Input id={FIELD_IDS.name} value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoComplete="name" placeholder="As it appears on your certificates" />
              </Field>

              <Field label="Mobile number" htmlFor={FIELD_IDS.mobile} required error={errors.mobile} hint="We contact you on this number and it tracks your application.">
                <PhoneInput id={FIELD_IDS.mobile} value={form.mobile} onChange={(v) => set("mobile", v)} invalid={!!errors.mobile} autoComplete="tel-national" />
              </Field>

              <Field label="Email address" htmlFor={FIELD_IDS.email} error={errors.email} hint="Optional — add it and we will email you every status update.">
                <Input id={FIELD_IDS.email} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} autoComplete="email" placeholder="you@example.com" />
              </Field>

              <Field
                label="City / District"
                htmlFor={FIELD_IDS.districtId}
                required
                error={errors.districtId}
                hint="Type and pick from the list. Choose the district your city belongs to."
                autoWire={false}
              >
                <DistrictCombobox
                  id={FIELD_IDS.districtId}
                  value={district}
                  onChange={(d) => {
                    setDistrict(d);
                    clearError("districtId");
                  }}
                  invalid={!!errors.districtId}
                  describedBy={describedBy(FIELD_IDS.districtId, true, !!errors.districtId)}
                />
              </Field>

              <Field label="Highest qualification" htmlFor={FIELD_IDS.qualification} required error={errors.qualification} hint="Pick a suggestion or type your own.">
                <Input
                  id={FIELD_IDS.qualification}
                  list="teacher-qualifications"
                  value={form.qualification}
                  onChange={(e) => set("qualification", e.target.value)}
                  invalid={!!errors.qualification}
                  placeholder="e.g. B.Ed., M.Sc. Mathematics"
                />
              </Field>
              <datalist id="teacher-qualifications">
                {QUALIFICATIONS.map((q) => (
                  <option key={q} value={q} />
                ))}
              </datalist>

              <Field label="Subjects you can teach" htmlFor={FIELD_IDS.subjects} required error={errors.subjects} hint="Type a subject and press Enter. Add as many as you like." autoWire={false}>
                <TagInput
                  id={FIELD_IDS.subjects}
                  value={form.subjects}
                  onChange={(v) => set("subjects", v)}
                  placeholder="e.g. Mathematics, Science, English"
                  invalid={!!errors.subjects}
                  aria-describedby={describedBy(FIELD_IDS.subjects, true, !!errors.subjects)}
                />
              </Field>

              {/* A group is not labelable, so the legend text is wired with aria-labelledby. */}
              <Field
                label={<span id={`${FIELD_IDS.classes}-label`}>Classes you can teach</span>}
                htmlFor={FIELD_IDS.classes}
                required
                error={errors.classes}
                className="md:col-span-2"
                autoWire={false}
              >
                <CheckboxCards
                  id={FIELD_IDS.classes}
                  name="classes"
                  value={form.classes}
                  onChange={(v) => set("classes", v as TeachingClassBand[])}
                  columns={2}
                  invalid={!!errors.classes}
                  aria-labelledby={`${FIELD_IDS.classes}-label`}
                  aria-describedby={describedBy(FIELD_IDS.classes, false, !!errors.classes)}
                  options={TEACHING_CLASS_BANDS.map((b) => ({ value: b, label: TEACHING_CLASS_LABEL[b], description: CLASS_DESCRIPTIONS[b] }))}
                />
              </Field>

              <Field label="Teaching experience" htmlFor={FIELD_IDS.experienceBand} required error={errors.experienceBand}>
                <Select
                  id={FIELD_IDS.experienceBand}
                  value={form.experienceBand}
                  onChange={(e) => set("experienceBand", e.target.value)}
                  placeholder="Select your experience"
                  invalid={!!errors.experienceBand}
                  options={TEACHING_EXPERIENCE_BANDS.map((b) => ({ value: b, label: TEACHING_EXPERIENCE_LABEL[b] }))}
                />
              </Field>

              <Field label="Teaching mode" htmlFor={FIELD_IDS.teachingMode} required error={errors.teachingMode} hint="How you would prefer to teach.">
                <Select
                  id={FIELD_IDS.teachingMode}
                  value={form.teachingMode}
                  onChange={(e) => set("teachingMode", e.target.value)}
                  placeholder="Select a mode"
                  invalid={!!errors.teachingMode}
                  options={TEACHING_MODES.map((m) => ({ value: m, label: TEACHING_MODE_LABEL[m] }))}
                />
              </Field>
            </div>

            {/* The anchor of the form: full width, its own framed section. */}
            <section aria-labelledby="resume-heading" className="rounded-xl border border-navy/15 bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id="resume-heading" className="text-h4 text-navy">
                  Resume / CV
                  <span className="ml-0.5 text-danger" aria-hidden>
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </h2>
                <p className="text-sm text-muted">Stored privately. Only the Foundation&rsquo;s trainer team can open it.</p>
              </div>
              <FileDropzone
                id={FIELD_IDS.resume!}
                value={resume}
                onChange={(f) => {
                  setResume(f);
                  if (f) clearError("resume");
                }}
                onError={() => clearError("resume")}
                accept={RESUME_ACCEPT}
                maxSizeMb={RESUME_MAX_MB}
                label="Attach your resume"
                error={errors.resume ?? null}
                disabled={submitting}
              />
            </section>

            <Field error={errors.consent} autoWire={false}>
              <Checkbox
                id={FIELD_IDS.consent}
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
                label="I confirm the information above is true and complete."
                description="I agree that EduSkill India Foundation may store these details and my resume, verify my qualifications and contact me about this application."
              />
            </Field>

            <div className="border-t border-line pt-6">
              <Button type="submit" size="lg" fullWidth loading={submitting} leftIcon={<Send className="h-4 w-4" />} className="sm:w-auto sm:min-w-64">
                Submit Application
              </Button>
              <p className="mt-3 text-body-sm text-muted">
                Already applied?{" "}
                <Link href="/become-a-trainer/status" className="font-semibold text-orange underline-offset-4 ring-focus hover:underline">
                  Track your application status
                </Link>
              </p>
            </div>
          </CardBody>
        </Card>
      </form>

      <Alert tone="info" className="mt-6">
        Want to volunteer at block or state level, or add your photo, languages and other documents up front? Use the{" "}
        <Link href="/become-a-trainer/apply" className="font-semibold underline underline-offset-2">
          full volunteer trainer application
        </Link>
        . Both land with the same review team.
      </Alert>
      <noscript>
        <p className="mt-4 text-body-sm text-muted">
          This form needs JavaScript. Please{" "}
          <a href={withBasePath("/contact")} className="font-semibold underline">
            contact us
          </a>{" "}
          and we will take your details.
        </p>
      </noscript>
    </div>
  );
}
