"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, Clock, FileCheck2, ListFilter, MapPin, Pencil, Search, Sparkles, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Field, FormGrid } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { WizardShell } from "@/components/ui/wizard-shell";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { toast } from "@/components/ui/toast";
import { useHideBottomNav } from "@/components/portal/header-context";
import { useScrollIntoViewOnFocus } from "@/lib/hooks";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { cn, formatDate, formatINR, titleCase } from "@/lib/utils";
import { DocumentsChecklist, type ChecklistDoc } from "@/components/student/documents-checklist";
import {
  ADDRESS_FIELDS,
  AddressFields,
  ContactFields,
  EDUCATION_FIELDS,
  EducationFields,
  PERSONAL_FIELDS,
  PROFILE_LABELS,
  PROFILE_REQUIRED,
  PersonalDetailsFields,
  profilePayload,
  type ProfileFieldSetter,
  type ProfileFormValues,
} from "@/components/student/profile-form";

interface CenterResult {
  id: string;
  code: string;
  name: string;
  address: string;
  landmark?: string | null;
  villageTown: string | null;
  pincode: string;
  phone: string | null;
  isVerified: boolean;
  state: { name: string };
  district: { name: string };
  block: { name: string };
  courses: { course: { id: string; name: string } }[];
  availableSeats: number;
  openBatches: number;
  trainerCount?: number;
  studentCount?: number;
}

interface CourseResult {
  id: string;
  code: string;
  name: string;
  shortDescription: string | null;
  durationText: string;
  level: string;
  mode: string;
  courseFee: number;
  registrationFee: number;
  examFee: number;
  certificateFee: number;
  totalFee: number;
  scholarshipAvailable: boolean;
  eligibility: string | null;
  minAge: number | null;
  maxAge: number | null;
  category: { name: string } | null;
}

interface CourseDetail {
  id: string;
  name: string;
  scholarshipAvailable: boolean;
  scholarshipNote: string | null;
  originalFee: number;
  feeLines: { type: string; description: string; amount: number }[];
  requiredDocumentTypes: { key: string; name: string; description?: string | null }[];
  minAttendancePct: number;
  totalClasses: number;
}

interface BatchResult {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  days: string[];
  room: string | null;
  status: string;
  capacity: number;
  occupied: number;
  available: number;
  trainerName: string | null;
  schedule: string;
}

/** Existing DRAFT application the wizard resumes instead of creating a second one (DECISION 4). */
export interface DraftApplicationInfo {
  id: string;
  applicationNo: string;
  centerId: string;
  courseId: string;
  batchId: string | null;
  scholarshipRequested: boolean;
  scholarshipReason: string | null;
}

export interface ApplyWizardProps {
  studentId: string;
  /** Current profile values; steps 1–3 edit them and save via PUT /api/student/profile. */
  profile: ProfileFormValues;
  profileCompleted: boolean;
  admissionsOpen: boolean;
  courseOptions: { id: string; name: string }[];
  initialCenterId?: string;
  initialCourseId?: string;
  /** The student's open DRAFT application, when they already have one. */
  draftApplication?: DraftApplicationInfo | null;
}

const STEPS = [
  { label: "Personal details", description: "About you" },
  { label: "Address", description: "Where you live" },
  { label: "Education", description: "Qualification" },
  { label: "Training center", description: "Near you" },
  { label: "Course & batch", description: "What & when" },
  { label: "Documents", description: "Upload proof" },
  { label: "Scholarship", description: "Fee support" },
  { label: "Review", description: "Check details" },
  { label: "Payment", description: "Fees" },
  { label: "Confirmation", description: "All done" },
];

const STEP_PERSONAL = 0;
const STEP_ADDRESS = 1;
const STEP_EDUCATION = 2;
const STEP_CENTER = 3;
const STEP_COURSE = 4;
const STEP_DOCUMENTS = 5;
const STEP_SCHOLARSHIP = 6;
const STEP_REVIEW = 7;
const STEP_PAYMENT = 8;
const STEP_CONFIRM = 9;

const PROFILE_STEP_FIELDS: (keyof ProfileFormValues)[][] = [PERSONAL_FIELDS, ADDRESS_FIELDS, EDUCATION_FIELDS];

/* ───────────────────────── local (client) draft ───────────────────────── */

interface LocalDraft {
  step: number;
  centerId?: string;
  courseId?: string;
  batchId?: string;
  scholarship?: boolean;
  reason?: string;
  applicationId?: string;
  updatedAt: string;
}

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const draftKey = (studentId: string) => `esif.applyDraft.${studentId}`;

function readLocalDraft(studentId: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(studentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft;
    if (typeof parsed?.step !== "number") return null;
    if (parsed.updatedAt && Date.now() - new Date(parsed.updatedAt).getTime() > DRAFT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalDraft(studentId: string, draft: LocalDraft) {
  try {
    window.localStorage.setItem(draftKey(studentId), JSON.stringify(draft));
  } catch {
    /* private mode / quota – the server DRAFT is the source of truth */
  }
}

function clearLocalDraft(studentId: string) {
  try {
    window.localStorage.removeItem(draftKey(studentId));
  } catch {
    /* ignore */
  }
}

/* ───────────────────────────── the wizard ───────────────────────────── */

export function ApplyWizard({ studentId, profile, profileCompleted, admissionsOpen, courseOptions, initialCenterId, initialCourseId, draftApplication }: ApplyWizardProps) {
  const router = useRouter();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState(profileCompleted ? STEP_CENTER : STEP_PERSONAL);
  const [hydrated, setHydrated] = React.useState(false);

  // Steps 1–3: the student profile
  const [form, setForm] = React.useState<ProfileFormValues>(profile);
  const [profileErrors, setProfileErrors] = React.useState<Record<string, string>>({});
  const [profileDone, setProfileDone] = React.useState(profileCompleted);

  // Step 4: training center
  const [location, setLocation] = React.useState<LocationValue>({});
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [courseFilter, setCourseFilter] = React.useState(initialCourseId ?? "");
  const [q, setQ] = React.useState("");
  const [centers, setCenters] = React.useState<CenterResult[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [center, setCenter] = React.useState<CenterResult | null>(null);

  // Step 5: course + batch
  const [courses, setCourses] = React.useState<CourseResult[] | null>(null);
  const [course, setCourse] = React.useState<CourseResult | null>(null);
  const [detail, setDetail] = React.useState<CourseDetail | null>(null);
  const [batches, setBatches] = React.useState<BatchResult[] | null>(null);
  const [batchId, setBatchId] = React.useState<string>("");

  // Step 6: documents
  const [documents, setDocuments] = React.useState<ChecklistDoc[] | null>(null);

  // Step 7: scholarship
  const [scholarship, setScholarship] = React.useState(draftApplication?.scholarshipRequested ?? false);
  const [reason, setReason] = React.useState(draftApplication?.scholarshipReason ?? "");

  // Server draft + submission
  const [draftId, setDraftId] = React.useState<string | null>(draftApplication?.id ?? null);
  const [applicationNo, setApplicationNo] = React.useState<string | null>(draftApplication?.applicationNo ?? null);
  const [submitted, setSubmitted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pendingCourseId = React.useRef<string>(initialCourseId ?? draftApplication?.courseId ?? "");
  const pendingBatchId = React.useRef<string>(draftApplication?.batchId ?? "");

  // The wizard owns the whole screen on phones: no bottom nav while it is mounted.
  useHideBottomNav(true);
  useScrollIntoViewOnFocus(bodyRef);

  /** Fetches the student's document library (used by the Documents and Review steps). */
  const loadDocuments = React.useCallback(async () => {
    try {
      const d = await api.get<{ documents: ChecklistDoc[] }>("/api/student/documents");
      setDocuments(d.documents);
    } catch (err) {
      toast.error("Could not load your documents", errorMessage(err));
      setDocuments([]);
    }
  }, []);

  /* ── Rehydrate from localStorage / the existing DRAFT (all state updates happen asynchronously) ── */
  React.useEffect(() => {
    let cancelled = false;
    const stored = readLocalDraft(studentId);
    const wantedCenter = stored?.centerId || draftApplication?.centerId || initialCenterId || "";
    pendingCourseId.current = stored?.courseId || draftApplication?.courseId || initialCourseId || "";
    pendingBatchId.current = stored?.batchId ?? draftApplication?.batchId ?? "";
    const appId = draftApplication?.id ?? stored?.applicationId ?? null;

    (async () => {
      let target = stored?.step ?? (draftApplication ? STEP_DOCUMENTS : profileCompleted ? STEP_CENTER : STEP_PERSONAL);
      target = Math.min(Math.max(target, 0), STEP_REVIEW); // a DRAFT can never resume on Payment / Confirmation
      let found: CenterResult | null = null;
      if (wantedCenter) {
        try {
          found = await api.get<CenterResult>(`/api/student/centers/${wantedCenter}`);
        } catch {
          found = null;
        }
      }
      if (cancelled) return;
      if (typeof stored?.scholarship === "boolean") setScholarship(stored.scholarship);
      if (typeof stored?.reason === "string" && stored.reason) setReason(stored.reason);
      if (appId && !draftApplication) setDraftId(appId);
      if (found) {
        setCenter(found);
        setCenters([found]);
      } else if (wantedCenter && initialCenterId === wantedCenter) {
        toast.error("Center not found", "Please search for a training center.");
      }
      if (!found) target = Math.min(target, STEP_CENTER);
      if (!appId) target = Math.min(target, STEP_COURSE);
      setStep(target);
      setHydrated(true);
      if (target >= STEP_DOCUMENTS) await loadDocuments();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Persist the client draft (debounced) ── */
  React.useEffect(() => {
    if (!hydrated || submitted) return;
    const t = setTimeout(() => {
      writeLocalDraft(studentId, {
        step,
        centerId: center?.id,
        courseId: course?.id,
        batchId: batchId || undefined,
        scholarship,
        reason,
        applicationId: draftId ?? undefined,
        updatedAt: new Date().toISOString(),
      });
    }, 400);
    return () => clearTimeout(t);
  }, [hydrated, submitted, studentId, step, center?.id, course?.id, batchId, scholarship, reason, draftId]);

  const search = React.useCallback(async (params: { location: LocationValue; courseId: string; q: string }) => {
    setSearching(true);
    try {
      const sp = new URLSearchParams();
      if (params.location.stateId) sp.set("stateId", params.location.stateId);
      if (params.location.districtId) sp.set("districtId", params.location.districtId);
      if (params.location.blockId) sp.set("blockId", params.location.blockId);
      if (params.courseId) sp.set("courseId", params.courseId);
      if (params.q.trim()) sp.set("q", params.q.trim());
      sp.set("limit", "24");
      const data = await api.get<{ items: CenterResult[] }>(`/api/student/centers?${sp.toString()}`);
      setCenters(data.items);
    } catch (err) {
      toast.error("Could not search centers", errorMessage(err));
    } finally {
      setSearching(false);
    }
  }, []);

  // Auto-search whenever the location or course filter changes.
  React.useEffect(() => {
    if (!hydrated) return;
    if (!location.stateId && !courseFilter && !q) return;
    const t = setTimeout(() => void search({ location, courseId: courseFilter, q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, location.stateId, location.districtId, location.blockId, courseFilter]);

  // Courses offered at the selected center.
  React.useEffect(() => {
    if (!center) return;
    let cancelled = false;
    api
      .get<{ courses: CourseResult[] }>(`/api/public/courses?centerId=${center.id}`)
      .then((d) => {
        if (cancelled) return;
        setCourses(d.courses);
        const wanted = pendingCourseId.current;
        if (wanted) {
          const pre = d.courses.find((c) => c.id === wanted);
          if (pre) setCourse((prev) => prev ?? pre);
        }
      })
      .catch((err) => toast.error("Could not load courses", errorMessage(err)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.id]);

  // Fee detail + batches for the chosen course.
  React.useEffect(() => {
    if (!center || !course) return;
    let cancelled = false;
    Promise.all([api.get<CourseDetail>(`/api/student/courses/${course.id}`), api.get<{ batches: BatchResult[] }>(`/api/student/batches?centerId=${center.id}&courseId=${course.id}`)])
      .then(([d, b]) => {
        if (cancelled) return;
        setDetail(d);
        setBatches(b.batches);
        const wanted = pendingBatchId.current;
        if (wanted && b.batches.some((x) => x.id === wanted && x.available > 0)) {
          setBatchId((prev) => prev || wanted);
          pendingBatchId.current = "";
        }
      })
      .catch((err) => toast.error("Could not load course details", errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [center, course]);

  /* ── Selection helpers ── */
  const selectCenter = (c: CenterResult) => {
    if (center?.id !== c.id) {
      setCourses(null);
      setCourse(null);
      setDetail(null);
      setBatches(null);
      setBatchId("");
      pendingCourseId.current = "";
    }
    setCenter(c);
  };
  const selectCourse = (c: CourseResult) => {
    if (course?.id !== c.id) {
      setDetail(null);
      setBatches(null);
      setBatchId("");
      setScholarship(false);
      setReason("");
    }
    setCourse(c);
  };

  const selectedBatch = batches?.find((b) => b.id === batchId) ?? null;
  const canScholarship = !!detail?.scholarshipAvailable && (detail?.originalFee ?? 0) > 0;
  const requiredDocs = detail?.requiredDocumentTypes ?? [];
  const uploadedByType = React.useMemo(() => {
    const map: Record<string, ChecklistDoc> = {};
    for (const d of documents ?? []) if (!map[d.type]) map[d.type] = d;
    return map;
  }, [documents]);
  const missingDocs = requiredDocs.filter((r) => {
    const d = uploadedByType[r.key];
    return !d || d.status === "REJECTED";
  });
  const otherDocs = (documents ?? []).filter((d) => !requiredDocs.some((r) => r.key === d.type));

  /* ── Profile save (steps 1–3) ── */
  const setField = React.useCallback<ProfileFieldSetter>((k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setProfileErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  }, []);

  const validateProfileStep = (index: number): Record<string, string> => {
    const fields = PROFILE_STEP_FIELDS[index] ?? [];
    const errs: Record<string, string> = {};
    for (const k of PROFILE_REQUIRED) {
      if (fields.includes(k) && !String(form[k] ?? "").trim()) errs[k] = `${PROFILE_LABELS[k]} is required`;
    }
    if (index === STEP_PERSONAL && form.mobile && !/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(form.mobile.trim())) errs.mobile = "Enter a valid 10-digit Indian mobile number";
    if (index === STEP_PERSONAL && form.whatsapp && !/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(form.whatsapp.trim())) errs.whatsapp = "Enter a valid 10-digit Indian mobile number";
    if (index === STEP_ADDRESS && form.pincode && !/^[1-9]\d{5}$/.test(form.pincode.trim())) errs.pincode = "Enter a valid 6-digit PIN code";
    return errs;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const first = Object.keys(errs)[0];
    if (first) document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const saveProfileStep = async (index: number): Promise<boolean> => {
    const local = validateProfileStep(index);
    if (Object.keys(local).length) {
      setProfileErrors(local);
      focusFirstError(local);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/student/profile", profilePayload(form));
      setProfileDone(true);
      setProfileErrors({});
      router.refresh();
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fields = PROFILE_STEP_FIELDS[index] ?? [];
        const own = Object.fromEntries(Object.entries(err.fieldErrors).filter(([k]) => fields.includes(k as keyof ProfileFormValues)));
        if (Object.keys(own).length) {
          setProfileErrors(own);
          focusFirstError(own);
          return false;
        }
        // Only later steps are still incomplete – keep going, the profile is saved on the Education step.
        setProfileErrors({});
        return true;
      }
      setError(errorMessage(err, "Could not save your details. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /* ── Server draft ── */
  const draftBody = () => ({
    centerId: center!.id,
    courseId: course!.id,
    batchId: batchId || null,
    scholarshipRequested: canScholarship && scholarship,
    scholarshipReason: canScholarship && scholarship ? reason || null : null,
  });

  const ensureDraft = async (): Promise<string | null> => {
    if (!center || !course) return null;
    setBusy(true);
    setError(null);
    try {
      if (draftId) {
        await api.patch(`/api/student/applications/${draftId}`, draftBody());
        return draftId;
      }
      const data = await api.post<{ id: string; applicationNo: string }>("/api/student/applications", draftBody());
      setDraftId(data.id);
      setApplicationNo(data.applicationNo);
      return data.id;
    } catch (err) {
      setError(errorMessage(err, "Could not save your application. Please try again."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submitApplication = async (): Promise<boolean> => {
    const id = await ensureDraft();
    if (!id) return false;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/student/applications/${id}/submit`);
      setSubmitted(true);
      clearLocalDraft(studentId);
      toast.success("Application submitted", `${applicationNo ?? "Your application"} is with the Foundation for review.`);
      router.refresh();
      return true;
    } catch (err) {
      setError(errorMessage(err, "Could not submit your application. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /* ── Navigation ── */
  const goTo = (next: number) => {
    setError(null);
    setStep(next);
    if (next >= STEP_DOCUMENTS && documents === null) void loadDocuments();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onNext = async () => {
    if (step <= STEP_EDUCATION) {
      const ok = await saveProfileStep(step);
      if (ok) goTo(step + 1);
      return;
    }
    if (step === STEP_COURSE) {
      const id = await ensureDraft();
      if (id) goTo(STEP_DOCUMENTS);
      return;
    }
    if (step === STEP_SCHOLARSHIP) {
      const id = await ensureDraft();
      if (id) goTo(STEP_REVIEW);
      return;
    }
    if (step === STEP_REVIEW) {
      const ok = await submitApplication();
      if (ok) goTo(STEP_PAYMENT);
      return;
    }
    if (step === STEP_PAYMENT) {
      goTo(STEP_CONFIRM);
      return;
    }
    goTo(Math.min(STEP_CONFIRM, step + 1));
  };

  const saveLater = async () => {
    writeLocalDraft(studentId, {
      step,
      centerId: center?.id,
      courseId: course?.id,
      batchId: batchId || undefined,
      scholarship,
      reason,
      applicationId: draftId ?? undefined,
      updatedAt: new Date().toISOString(),
    });
    if (step <= STEP_EDUCATION) {
      if (!Object.keys(validateProfileStep(step)).length) await saveProfileStep(step);
    } else if (center && course) {
      await ensureDraft();
    }
    toast.success("Saved", "Continue your application any time from the dashboard.");
    router.push("/student/dashboard");
  };

  const nextLabel = (() => {
    switch (step) {
      case STEP_CENTER:
        return "Continue";
      case STEP_COURSE:
        return draftId ? "Save & continue" : "Start application";
      case STEP_DOCUMENTS:
        return "Continue";
      case STEP_SCHOLARSHIP:
        return "Review application";
      case STEP_REVIEW:
        return "Submit application";
      case STEP_PAYMENT:
        return "Finish";
      default:
        return "Continue";
    }
  })();

  const nextDisabled = (() => {
    switch (step) {
      case STEP_CENTER:
        return !center;
      case STEP_COURSE:
        return !course || !detail || !admissionsOpen;
      case STEP_SCHOLARSHIP:
        return !detail;
      case STEP_REVIEW:
        return !profileDone || !admissionsOpen || missingDocs.length > 0;
      default:
        return false;
    }
  })();

  return (
    <WizardShell
      steps={STEPS}
      current={step}
      onBack={step > 0 && step < STEP_PAYMENT ? () => goTo(step - 1) : undefined}
      onNext={step === STEP_CONFIRM ? undefined : () => void onNext()}
      nextLabel={nextLabel}
      nextDisabled={nextDisabled}
      nextLoading={busy}
      onSaveLater={step < STEP_PAYMENT ? () => void saveLater() : undefined}
      hideFooter={step === STEP_CONFIRM}
    >
      <div ref={bodyRef} className="space-y-4">
        {!admissionsOpen && (
          <Alert tone="warning" title="Admissions are currently closed">
            You can browse centers and courses, but new applications cannot be started right now. Please check back soon.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        {/* ───── 1 Personal details ───── */}
        {step === STEP_PERSONAL && (
          <Card>
            <CardBody className="space-y-6">
              <StepIntro title="Your details" text="These details appear on your application, ID card and certificate." />
              <PersonalDetailsFields form={form} set={setField} errors={profileErrors} />
              <div className="border-t border-line pt-5">
                <p className="mb-4 text-sm font-bold text-navy">Contact</p>
                <ContactFields form={form} set={setField} errors={profileErrors} />
              </div>
            </CardBody>
          </Card>
        )}

        {/* ───── 2 Address ───── */}
        {step === STEP_ADDRESS && (
          <Card>
            <CardBody className="space-y-6">
              <StepIntro title="Where do you live?" text="We use your block to suggest training centers close to you." />
              <AddressFields form={form} set={setField} errors={profileErrors} />
            </CardBody>
          </Card>
        )}

        {/* ───── 3 Education ───── */}
        {step === STEP_EDUCATION && (
          <Card>
            <CardBody className="space-y-6">
              <StepIntro title="Your education" text="Courses have minimum qualification requirements – this helps us place you correctly." />
              <EducationFields form={form} set={setField} errors={profileErrors} />
            </CardBody>
          </Card>
        )}

        {/* ───── 4 Training center ───── */}
        {step === STEP_CENTER && (
          <Card>
            <CardBody className="space-y-5">
              <StepIntro title="Find a training center" text="Search by name, code or PIN code, or filter by your state and district." />
              <div className="flex gap-2">
                <Input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Center name, town or PIN"
                  aria-label="Search training centers"
                  leftIcon={<Search className="h-4 w-4" />}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void search({ location, courseId: courseFilter, q }))}
                />
                <Button type="button" variant="navy" onClick={() => void search({ location, courseId: courseFilter, q })} loading={searching} className="shrink-0">
                  Search
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface/70 px-4 text-sm font-semibold text-navy tap-highlight-none lg:hidden"
              >
                <span className="inline-flex items-center gap-2">
                  <ListFilter className="h-4 w-4" /> Filter by state, district & course
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", filtersOpen && "rotate-180")} aria-hidden />
              </button>

              <div className={cn("space-y-4", filtersOpen ? "block" : "hidden", "lg:block")}>
                <LocationCascade value={location} onChange={setLocation} withCenters className="grid grid-cols-1 gap-4 sm:grid-cols-3" />
                <FormGrid cols={1}>
                  <Field label="Course" htmlFor="courseFilter">
                    <Select id="courseFilter" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} options={courseOptions.map((c) => ({ value: c.id, label: c.name }))} placeholder="Any course" />
                  </Field>
                </FormGrid>
              </div>

              {searching ? (
                <LoadingBlock label="Searching centers…" />
              ) : centers === null ? (
                <EmptyState icon={<MapPin className="h-7 w-7" />} title="Choose your location" description="Search by name or PIN code, or open the filter above to pick your state and district." />
              ) : centers.length === 0 ? (
                <EmptyState icon={<MapPin className="h-7 w-7" />} title="No centers found" description="Try a nearby district, remove the course filter or search by PIN code." />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Training centers">
                  {centers.map((c) => {
                    const selected = center?.id === c.id;
                    return (
                      <ChoiceCard key={c.id} selected={selected} onSelect={() => selectCenter(c)}>
                        <div className="pr-8">
                          <p className="font-bold text-navy">{c.name}</p>
                          <p className="font-mono text-xs text-muted">{c.code}</p>
                        </div>
                        <p className="text-sm text-muted">
                          {[c.villageTown, c.block?.name, c.district?.name, c.state?.name].filter(Boolean).join(", ")} · {c.pincode}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.isVerified && (
                            <Badge tone="success">
                              <BadgeCheck className="h-3 w-3" /> Verified
                            </Badge>
                          )}
                          <Badge tone={c.availableSeats > 0 ? "navy" : "warning"}>
                            <Users className="h-3 w-3" /> {c.availableSeats} seats
                          </Badge>
                          <Badge tone="neutral">{c.courses.length} courses</Badge>
                          <Badge tone="neutral">{c.openBatches} open batches</Badge>
                        </div>
                      </ChoiceCard>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* ───── 5 Course & batch ───── */}
        {step === STEP_COURSE && center && (
          <Card>
            <CardBody className="space-y-5">
              <SelectedSummary center={center} course={course} batch={course ? selectedBatch : undefined} />
              <StepIntro title="Choose a course" text={`Courses currently offered at ${center.name}.`} />
              {courses === null ? (
                <LoadingBlock label="Loading courses…" />
              ) : courses.length === 0 ? (
                <EmptyState title="No active courses at this center" description="Please go back and choose another training center." />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Courses">
                  {courses.map((c) => (
                    <ChoiceCard key={c.id} selected={course?.id === c.id} onSelect={() => selectCourse(c)}>
                      <div className="pr-8">
                        {c.category && <p className="text-xs font-bold tracking-wide text-orange uppercase">{c.category.name}</p>}
                        <p className="font-bold text-navy">{c.name}</p>
                        {c.shortDescription && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{c.shortDescription}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="neutral">
                          <Clock className="h-3 w-3" /> {c.durationText}
                        </Badge>
                        <Badge tone="neutral">{titleCase(c.level)}</Badge>
                        <Badge tone="neutral">{titleCase(c.mode)}</Badge>
                        {c.scholarshipAvailable && (
                          <Badge tone="success">
                            <Sparkles className="h-3 w-3" /> Scholarship
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">
                        <span className="font-bold text-ink">{c.totalFee > 0 ? formatINR(c.totalFee) : "Free"}</span>
                        {c.totalFee > 0 && <span className="text-muted"> total fee</span>}
                      </p>
                      {(c.eligibility || c.minAge || c.maxAge) && (
                        <p className="text-xs text-muted">
                          Eligibility: {c.eligibility ?? "Open to all"}
                          {c.minAge || c.maxAge ? ` · Age ${c.minAge ?? "any"}–${c.maxAge ?? "any"}` : ""}
                        </p>
                      )}
                    </ChoiceCard>
                  ))}
                </div>
              )}

              {course && (
                <div className="space-y-3 border-t border-line pt-5">
                  <StepIntro title="Choose a batch" text="Pick the timing that suits you, or let the Foundation allocate one." />
                  {batches === null ? (
                    <LoadingBlock label="Loading batches…" />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Batches">
                      {batches.map((b) => {
                        const full = b.available <= 0;
                        return (
                          <ChoiceCard key={b.id} selected={batchId === b.id} disabled={full} onSelect={() => setBatchId(b.id)}>
                            <div className="flex flex-wrap items-center gap-2 pr-8">
                              <p className="font-bold text-navy">{b.name}</p>
                              <span className="font-mono text-xs text-muted">{b.code}</span>
                              <StatusBadge status={b.status} />
                            </div>
                            <p className="flex items-start gap-1.5 text-sm text-ink">
                              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> {b.schedule}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDate(b.startDate)} – {formatDate(b.endDate)}
                              {b.room ? ` · Room ${b.room}` : ""}
                              {b.trainerName ? ` · ${b.trainerName}` : ""}
                            </p>
                            <Badge tone={full ? "danger" : b.available <= 3 ? "warning" : "success"}>{full ? "Batch full" : `${b.available} of ${b.capacity} seats available`}</Badge>
                          </ChoiceCard>
                        );
                      })}
                      <ChoiceCard selected={batchId === ""} onSelect={() => setBatchId("")} dashed>
                        <p className="pr-8 font-bold text-navy">Let the Foundation allocate a batch</p>
                        <p className="text-sm text-muted">{batches.length === 0 ? "No batches are open right now. Apply anyway and we will place you in the next batch." : "Not sure about timings? We will assign a suitable batch and notify you."}</p>
                      </ChoiceCard>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* ───── 6 Documents ───── */}
        {step === STEP_DOCUMENTS && (
          <Card>
            <CardBody className="space-y-5">
              <StepIntro title="Upload your documents" text="Take a photo with your camera or pick a file. PDF / JPG / PNG up to 5 MB each." />
              {documents === null || !detail ? (
                <LoadingBlock label="Loading your documents…" />
              ) : requiredDocs.length === 0 ? (
                <Alert tone="success" title="No documents required">
                  This course does not need any documents right now. The Foundation will ask if anything is needed.
                </Alert>
              ) : (
                <>
                  <p className="text-sm font-semibold text-navy">
                    {requiredDocs.length - missingDocs.length} of {requiredDocs.length} uploaded
                  </p>
                  <DocumentsChecklist applicationId={draftId ?? ""} required={requiredDocs} uploaded={uploadedByType} other={otherDocs} editable={!!draftId} onChange={() => void loadDocuments()} />
                  {missingDocs.length > 0 && (
                    <Alert tone="info" title="You can upload the rest later">
                      All required documents must be uploaded before the application can be submitted. Missing: {missingDocs.map((d) => d.name).join(", ")}.
                    </Alert>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        )}

        {/* ───── 7 Scholarship ───── */}
        {step === STEP_SCHOLARSHIP && course && (
          <Card>
            <CardBody className="space-y-5">
              <StepIntro title="Fees & scholarship" text="Nothing is charged now. Fees are payable only after your application is approved." />
              {detail === null ? (
                <LoadingBlock label="Loading fee details…" />
              ) : (
                <>
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {detail.feeLines.length === 0 ? (
                      <li className="p-4 text-sm font-semibold text-green-700">This course is free of cost.</li>
                    ) : (
                      <>
                        {detail.feeLines.map((l) => (
                          <li key={l.type} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <span className="text-ink">{l.description}</span>
                            <span className="font-medium text-ink tabular-nums">{formatINR(l.amount)}</span>
                          </li>
                        ))}
                        <li className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
                          <span className="font-bold text-navy">Total course fee</span>
                          <span className="text-lg font-extrabold text-navy tabular-nums">{formatINR(detail.originalFee)}</span>
                        </li>
                      </>
                    )}
                  </ul>
                  {canScholarship ? (
                    <div className="space-y-3 rounded-xl border border-line bg-surface/60 p-4">
                      <Checkbox checked={scholarship} onChange={(e) => setScholarship(e.target.checked)} label="I would like to request a scholarship for this course" description={detail.scholarshipNote ?? "Need-based and merit scholarships may reduce your payable fee."} />
                      {scholarship && (
                        <Field label="Why do you need scholarship support?" htmlFor="reason" hint="Briefly describe your family situation. Supporting documents (income certificate) can be uploaded with the application.">
                          <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                        </Field>
                      )}
                      <p className="text-xs text-muted">The scholarship decision is made by the Foundation after reviewing your application. The payable fee shown may change.</p>
                    </div>
                  ) : (
                    detail.originalFee > 0 && <p className="text-sm text-muted">Scholarships are not offered for this course.</p>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        )}

        {/* ───── 8 Review ───── */}
        {step === STEP_REVIEW && center && course && (
          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-4">
                <StepIntro title="Review & submit" text="Check everything below. You can edit any section before submitting." />
                <dl className="space-y-3">
                  <ReviewItem label="Name" value={form.name || "—"} sub={[form.gender ? titleCase(form.gender) : null, form.dob ? formatDate(form.dob) : null].filter(Boolean).join(" · ")} onEdit={() => goTo(STEP_PERSONAL)} />
                  <ReviewItem label="Contact" value={form.mobile || "—"} sub={[form.whatsapp ? `WhatsApp ${form.whatsapp}` : null, form.email].filter(Boolean).join(" · ")} onEdit={() => goTo(STEP_PERSONAL)} />
                  <ReviewItem label="Address" value={[form.villageTown, form.address].filter(Boolean).join(", ") || "—"} sub={form.pincode ? `PIN ${form.pincode}` : undefined} onEdit={() => goTo(STEP_ADDRESS)} />
                  <ReviewItem label="Education" value={form.qualification || "—"} sub={[form.institution, form.passingYear].filter(Boolean).join(" · ")} onEdit={() => goTo(STEP_EDUCATION)} />
                  <ReviewItem label="Training center" value={`${center.name} (${center.code})`} sub={[center.villageTown, center.district?.name, center.state?.name].filter(Boolean).join(", ")} onEdit={() => goTo(STEP_CENTER)} />
                  <ReviewItem label="Course" value={course.name} sub={`${course.durationText} · ${titleCase(course.mode)}`} onEdit={() => goTo(STEP_COURSE)} />
                  <ReviewItem label="Batch" value={selectedBatch ? `${selectedBatch.name} (${selectedBatch.code})` : "To be allocated by the Foundation"} sub={selectedBatch?.schedule} onEdit={() => goTo(STEP_COURSE)} />
                  <ReviewItem label="Documents" value={requiredDocs.length === 0 ? "None required" : `${requiredDocs.length - missingDocs.length} of ${requiredDocs.length} uploaded`} sub={missingDocs.length ? `Missing: ${missingDocs.map((d) => d.name).join(", ")}` : undefined} onEdit={() => goTo(STEP_DOCUMENTS)} />
                  <ReviewItem label="Course fee" value={detail && detail.originalFee > 0 ? formatINR(detail.originalFee) : "Free"} sub={canScholarship && scholarship ? "Scholarship requested" : undefined} onEdit={() => goTo(STEP_SCHOLARSHIP)} />
                </dl>
              </CardBody>
            </Card>
            {missingDocs.length > 0 && (
              <Alert tone="warning" title="Documents still missing" action={<Button size="sm" variant="navy" onClick={() => goTo(STEP_DOCUMENTS)}>Upload now</Button>}>
                Upload {missingDocs.map((d) => d.name).join(", ")} before submitting.
              </Alert>
            )}
            {!profileDone && (
              <Alert tone="warning" title="Profile incomplete" action={<Button size="sm" variant="navy" onClick={() => goTo(STEP_PERSONAL)}>Complete now</Button>}>
                Your personal details, address and education must be saved before the application can be submitted.
              </Alert>
            )}
          </div>
        )}

        {/* ───── 9 Payment ───── */}
        {step === STEP_PAYMENT && (
          <Card>
            <CardBody className="space-y-5">
              <StepIntro title="Fees & payment" text="Your application is submitted. Fees become payable once the Foundation approves it." />
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-base">
                  <span className="text-muted">Course fee</span>
                  <span className="font-medium text-ink tabular-nums">{detail && detail.originalFee > 0 ? formatINR(detail.originalFee) : "Free"}</span>
                </li>
                <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-base">
                  <span className="text-muted">Scholarship</span>
                  <span className="font-medium text-ink">{canScholarship && scholarship ? "Requested – decided by the Foundation" : "Not requested"}</span>
                </li>
                <li className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
                  <span className="text-base font-semibold text-ink">Payable now</span>
                  <span className="text-2xl font-extrabold text-orange tabular-nums">{formatINR(0)}</span>
                </li>
              </ul>
              <Alert tone="info" title="Nothing to pay right now">
                Fees are payable only after approval. We will notify you by SMS and in the app, and the fee then appears under Fees &amp; Payments with online and offline options.
              </Alert>
              {draftId && (
                <ButtonLink href={`/student/payments/${draftId}`} variant="outline" size="lg" fullWidth className="lg:w-auto">
                  Open fees &amp; payments
                </ButtonLink>
              )}
            </CardBody>
          </Card>
        )}

        {/* ───── 10 Confirmation ───── */}
        {step === STEP_CONFIRM && (
          <Card className="mx-auto max-w-xl">
            <CardBody className="space-y-5 py-6 text-center">
              <div className="flex justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success" aria-hidden>
                  <CheckCircle2 className="h-9 w-9" />
                </span>
              </div>
              <div>
                <h2 className="font-heading text-xl font-extrabold text-navy">Application submitted</h2>
                <p className="mt-1 text-sm text-muted">Keep your application number safe – you will need it for any query.</p>
              </div>
              <p className="rounded-xl bg-lavender px-4 py-3 font-mono text-lg font-bold text-navy">{applicationNo ?? "—"}</p>
              <ol className="space-y-3 text-left">
                <NextStep icon={<FileCheck2 className="h-4 w-4" />} title="Document verification" text="The Foundation verifies your documents. You will be notified if anything else is needed." />
                <NextStep icon={<BadgeCheck className="h-4 w-4" />} title="Approval" text="Once approved, your fee (after any scholarship) becomes payable in the app." />
                <NextStep icon={<Users className="h-4 w-4" />} title="Batch allocation" text="Your batch and trainer are confirmed and your Student ID is issued." />
              </ol>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                {draftId && (
                  <ButtonLink href={`/student/applications/${draftId}`} size="lg" variant="navy" fullWidth className="sm:w-auto">
                    Track my application
                  </ButtonLink>
                )}
                <ButtonLink href="/student/dashboard" size="lg" variant="outline" fullWidth className="sm:w-auto">
                  Go to dashboard
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </WizardShell>
  );
}

/* ───────────────────────────── small pieces ───────────────────────────── */

function StepIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-navy lg:text-lg">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{text}</p>
    </div>
  );
}

/** Tappable radio card used for centers, courses and batches (whole card is the target). */
function ChoiceCard({ selected, disabled, dashed, onSelect, children }: { selected: boolean; disabled?: boolean; dashed?: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all tap-highlight-none active:scale-[0.99] motion-reduce:transition-none",
        dashed ? "border-dashed bg-surface/60" : "bg-white",
        selected ? "border-orange bg-orange-light/50 ring-2 ring-orange/30" : "border-line hover:border-navy/40",
        disabled && "cursor-not-allowed opacity-60 hover:border-line"
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange text-white" aria-hidden>
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      {children}
    </button>
  );
}

function SelectedSummary({ center, course, batch }: { center: CenterResult; course?: CourseResult | null; batch?: BatchResult | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-lavender px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
        <Building2 className="h-4 w-4 shrink-0" /> {center.name}
      </span>
      {course && (
        <>
          <span className="text-navy/40">›</span>
          <span className="font-semibold text-navy">{course.name}</span>
        </>
      )}
      {batch !== undefined && (
        <>
          <span className="text-navy/40">›</span>
          <span className="text-navy">{batch ? `${batch.name} · ${batch.schedule}` : "Batch to be allocated"}</span>
        </>
      )}
    </div>
  );
}

function ReviewItem({ label, value, sub, onEdit }: { label: string; value: string; sub?: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-line p-4">
      <div className="min-w-0">
        <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
        <dd className="mt-1 font-semibold break-words text-ink">{value}</dd>
        {sub && <dd className="text-xs text-muted">{sub}</dd>}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${label}`} leftIcon={<Pencil className="h-4 w-4" />} className="shrink-0">
        Edit
      </Button>
    </div>
  );
}

function NextStep({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lavender text-navy" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </li>
  );
}

