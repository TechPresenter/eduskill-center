"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, RadioCards, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Stepper, Timeline } from "@/components/ui/misc";
import { FileUpload, TagInput, type UploadedFile } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { LocationCascade } from "@/components/shared/location-cascade";
import { toast } from "@/components/ui/toast";

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
  name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  dob: string;
  gender: string;
  level: Level | "";
  stateId?: string;
  districtId?: string;
  blockId?: string;
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
  { label: "Personal", description: "Contact details" },
  { label: "Level", description: "Block / District / State" },
  { label: "Location", description: "Where you will serve" },
  { label: "Professional", description: "Skills & experience" },
  { label: "Motivation", description: "Why you volunteer" },
  { label: "Documents", description: "Upload after submit" },
];

const STEP_FIELDS: string[][] = [
  ["name", "mobile", "whatsapp", "email", "dob", "gender"],
  ["level"],
  ["stateId", "districtId", "blockId", "address", "pincode"],
  ["qualification", "skills", "experienceYears", "teachingExperienceYears", "preferredCourseIds", "languages", "availability", "trainingMode"],
  ["motivation", "acceptTerms"],
];

const MOBILE_RE = /^(\+?91[\s-]?)?[6-9]\d{9}$/;
const PIN_RE = /^[1-9]\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = "esk.trainerApplication";

function depthFor(level: Level | ""): "state" | "district" | "block" {
  return level === "STATE" ? "state" : level === "DISTRICT" ? "district" : "block";
}

function validateStep(step: number, f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (f.name.trim().length < 2) e.name = "Enter your full name";
    if (!MOBILE_RE.test(f.mobile.trim())) e.mobile = "Enter a valid 10-digit Indian mobile number";
    if (f.whatsapp.trim() && !MOBILE_RE.test(f.whatsapp.trim())) e.whatsapp = "Enter a valid 10-digit WhatsApp number";
    if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address";
    if (!f.dob) e.dob = "Enter your date of birth";
    else if (new Date(f.dob) > new Date()) e.dob = "Date of birth cannot be in the future";
    if (!f.gender) e.gender = "Select your gender";
  }
  if (step === 1 && !f.level) e.level = "Choose the level you want to volunteer at";
  if (step === 2) {
    if (!f.stateId) e.stateId = "Select your state";
    if ((f.level === "DISTRICT" || f.level === "BLOCK") && !f.districtId) e.districtId = "Select your district";
    if (f.level === "BLOCK" && !f.blockId) e.blockId = "Select your block";
    if (f.address.trim().length < 5) e.address = "Enter your address";
    if (!PIN_RE.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit PIN code";
  }
  if (step === 3) {
    if (f.qualification.trim().length < 2) e.qualification = "Enter your highest qualification";
    if (f.skills.length === 0) e.skills = "Add at least one skill you can teach";
    const exp = Number(f.experienceYears);
    const texp = Number(f.teachingExperienceYears);
    if (!Number.isInteger(exp) || exp < 0 || exp > 60) e.experienceYears = "Enter years between 0 and 60";
    if (!Number.isInteger(texp) || texp < 0 || texp > 60) e.teachingExperienceYears = "Enter years between 0 and 60";
    if (f.languages.length === 0) e.languages = "Add at least one language";
  }
  if (step === 4) {
    if (f.motivation.trim().length < 30) e.motivation = "Please write at least a few sentences (30+ characters)";
    if (!f.acceptTerms) e.acceptTerms = "You must accept the declaration to continue";
  }
  return e;
}

export function TrainerApplyForm({ documentTypes }: { documentTypes: DocType[] }) {
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
  const topRef = React.useRef<HTMLDivElement>(null);

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
          setStep(5);
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
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(s + 1, 4));
    scrollTop();
  };
  const back = () => {
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  const submit = async () => {
    const e = validateStep(4, form);
    setErrors(e);
    if (Object.keys(e).length) return;
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
        blockId: form.level === "BLOCK" ? (form.blockId ?? "") : "",
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
      };
      const data = await api.post<Submitted>("/api/public/trainer-applications", payload);
      setSubmitted(data);
      persist(data, {}, null);
      setStep(5);
      scrollTop();
      toast.success("Application submitted", `Your application number is ${data.applicationNo}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 422) {
          const fe = err.fieldErrors;
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
    setStep(0);
  };

  const depth = depthFor(form.level);
  const requiredMissing = documentTypes.filter((d) => d.isRequired && !docs[d.key]);

  if (done && submitted) {
    return (
      <div ref={topRef} className="mx-auto max-w-2xl">
        <Card>
          <CardBody className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="mt-5 font-heading text-2xl font-extrabold text-navy">Thank you for volunteering!</h2>
            <p className="mt-2 text-sm text-muted">Your application has been received. Save your application number — you will need it, along with your registered mobile number, to track progress.</p>
            <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-muted uppercase">Application number</p>
            <p className="mt-1 font-heading text-3xl font-extrabold tracking-wide text-orange sm:text-4xl">{submitted.applicationNo}</p>
            <div className="mt-8 text-left">
              <h3 className="mb-4 text-sm font-bold text-navy">What happens next</h3>
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
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={`/become-a-trainer/status?no=${encodeURIComponent(submitted.applicationNo)}`} variant="navy">
                Track application status
              </ButtonLink>
              <ButtonLink href="/" variant="outline">
                Back to home
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div ref={topRef} className="mx-auto max-w-4xl scroll-mt-24">
      <Stepper steps={STEPS} current={step} className="mb-8" />
      {formError && (
        <Alert tone="danger" className="mb-6">
          {formError}
        </Alert>
      )}

      {step === 5 && submitted ? (
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
                      <p className="text-sm font-semibold text-ink">{d.name}</p>
                      <Badge tone={d.isRequired ? "orange" : "neutral"}>{d.isRequired ? "Required" : "Optional"}</Badge>
                    </div>
                    {d.description && <p className="text-xs text-muted">{d.description}</p>}
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
            <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
              <button type="button" onClick={startNew} className="text-sm font-medium text-muted hover:text-navy">
                Start a new application
              </button>
              <Button onClick={finish} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {requiredMissing.length ? "Finish for now" : "Finish"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6 sm:p-8">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 4) next();
                else void submit();
              }}
            >
              {step === 0 && (
                <FormSection title="Personal details" description="We use these to contact you about your application.">
                  <FormGrid>
                    <Field label="Full name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
                      <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoComplete="name" />
                    </Field>
                    <Field label="Mobile number" htmlFor="mobile" required error={errors.mobile} hint="10-digit Indian mobile. Used to track your application.">
                      <Input id="mobile" inputMode="numeric" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} invalid={!!errors.mobile} autoComplete="tel" />
                    </Field>
                    <Field label="WhatsApp number" htmlFor="whatsapp" error={errors.whatsapp} hint="Leave blank if same as mobile.">
                      <Input id="whatsapp" inputMode="numeric" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} invalid={!!errors.whatsapp} />
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
                  <p className="text-xs text-muted">You will be able to upload a passport photo and your documents right after submitting.</p>
                </FormSection>
              )}

              {step === 1 && (
                <FormSection title="Volunteer level" description="Choose the geography you would like to serve. This decides which location details we ask for next.">
                  <Field error={errors.level}>
                    <RadioCards
                      name="level"
                      value={form.level || undefined}
                      onChange={(v) => {
                        const lvl = v as Level;
                        setForm((f) => ({ ...f, level: lvl, districtId: lvl === "STATE" ? undefined : f.districtId, blockId: lvl === "BLOCK" ? f.blockId : undefined }));
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
                </FormSection>
              )}

              {step === 2 && (
                <FormSection title="Location" description={form.level === "STATE" ? "Select the state you will serve." : form.level === "DISTRICT" ? "Select your state and district." : "Select your state, district and block."}>
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
                    depth={depth}
                    required
                    errors={{ stateId: errors.stateId, districtId: errors.districtId, blockId: errors.blockId }}
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

              {step === 3 && (
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
                        <p className="text-sm text-muted">Loading courses…</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
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

              {step === 4 && (
                <FormSection title="Motivation & declaration">
                  <Field label="Why do you want to become a volunteer trainer?" htmlFor="motivation" required error={errors.motivation} hint={`${form.motivation.trim().length} / 3000 characters (minimum 30)`}>
                    <Textarea id="motivation" rows={6} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} invalid={!!errors.motivation} />
                  </Field>
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

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
                <div>
                  {step > 0 && (
                    <Button type="button" variant="outline" onClick={back} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                      Back
                    </Button>
                  )}
                </div>
                {step < 4 ? (
                  <Button type="submit" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Continue
                  </Button>
                ) : (
                  <Button type="submit" loading={submitting} size="lg" rightIcon={<Send className="h-4 w-4" />}>
                    Submit application
                  </Button>
                )}
              </div>
            </form>
          </CardBody>
        </Card>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Already applied?{" "}
        <Link href="/become-a-trainer/status" className="font-semibold text-orange hover:underline">
          Track your application status
        </Link>
      </p>
    </div>
  );
}
