"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormActions, FormGrid, FormSection } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/file-upload";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ImageField } from "@/components/admin/shared/image-field";
import { IconPicker } from "@/components/admin/shared/icon-picker";

export interface SyllabusModule {
  key: string;
  module: string;
  title: string;
  topics: string[];
}

export interface CourseFormInitial {
  id: string;
  name: string;
  code: string;
  categoryId: string | null;
  shortDescription: string | null;
  description: string | null;
  image: string | null;
  icon: string | null;
  durationText: string;
  durationWeeks: number;
  level: string;
  mode: string;
  eligibility: string | null;
  minAge: number | null;
  maxAge: number | null;
  syllabus: { module: string; title: string; topics: string[] }[];
  totalClasses: number;
  courseFee: number;
  registrationFee: number;
  examFee: number;
  certificateFee: number;
  scholarshipAvailable: boolean;
  scholarshipNote: string | null;
  certificateEligibility: string | null;
  minAttendancePct: number;
  passingMarksPct: number;
  requiredDocuments: string[];
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface CourseFormProps {
  initial?: CourseFormInitial;
  categories: { id: string; name: string; isActive: boolean }[];
  documentTypes: { key: string; name: string; isRequired: boolean; description: string | null }[];
}

let seq = 0;
const mkModule = (module = "", title = "", topics: string[] = []): SyllabusModule => ({ key: `m${++seq}`, module, title, topics });

export function CourseForm({ initial, categories, documentTypes }: CourseFormProps) {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [code, setCode] = React.useState(initial?.code ?? "");
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? "");
  const [shortDescription, setShortDescription] = React.useState(initial?.shortDescription ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [image, setImage] = React.useState(initial?.image ?? "");
  const [icon, setIcon] = React.useState(initial?.icon ?? "");
  const [durationText, setDurationText] = React.useState(initial?.durationText ?? "");
  const [durationWeeks, setDurationWeeks] = React.useState(String(initial?.durationWeeks ?? 0));
  const [level, setLevel] = React.useState(initial?.level ?? "BEGINNER");
  const [mode, setMode] = React.useState(initial?.mode ?? "OFFLINE");
  const [eligibility, setEligibility] = React.useState(initial?.eligibility ?? "");
  const [minAge, setMinAge] = React.useState(initial?.minAge?.toString() ?? "");
  const [maxAge, setMaxAge] = React.useState(initial?.maxAge?.toString() ?? "");
  const [syllabus, setSyllabus] = React.useState<SyllabusModule[]>(() => (initial?.syllabus.length ? initial.syllabus.map((m) => mkModule(m.module, m.title, m.topics)) : [mkModule("Module 1", "")]));
  const [totalClasses, setTotalClasses] = React.useState(String(initial?.totalClasses ?? 0));
  const [courseFee, setCourseFee] = React.useState(String(initial?.courseFee ?? 0));
  const [registrationFee, setRegistrationFee] = React.useState(String(initial?.registrationFee ?? 0));
  const [examFee, setExamFee] = React.useState(String(initial?.examFee ?? 0));
  const [certificateFee, setCertificateFee] = React.useState(String(initial?.certificateFee ?? 0));
  const [scholarshipAvailable, setScholarshipAvailable] = React.useState(initial?.scholarshipAvailable ?? false);
  const [scholarshipNote, setScholarshipNote] = React.useState(initial?.scholarshipNote ?? "");
  const [certificateEligibility, setCertificateEligibility] = React.useState(initial?.certificateEligibility ?? "");
  const [minAttendancePct, setMinAttendancePct] = React.useState(String(initial?.minAttendancePct ?? 75));
  const [passingMarksPct, setPassingMarksPct] = React.useState(String(initial?.passingMarksPct ?? 40));
  const [requiredDocuments, setRequiredDocuments] = React.useState<string[]>(initial?.requiredDocuments ?? documentTypes.filter((d) => d.isRequired).map((d) => d.key));
  const [status, setStatus] = React.useState(initial?.status ?? "DRAFT");
  const [isFeatured, setIsFeatured] = React.useState(initial?.isFeatured ?? false);
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));
  const [seoTitle, setSeoTitle] = React.useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = React.useState(initial?.seoDescription ?? "");

  const totalFee = [courseFee, registrationFee, examFee, certificateFee].reduce((a, b) => a + (Number(b) || 0), 0);

  const updateModule = (i: number, patch: Partial<SyllabusModule>) => setSyllabus((s) => s.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const moveModule = (i: number, dir: -1 | 1) =>
    setSyllabus((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name,
      code: code.toUpperCase(),
      categoryId: categoryId || "",
      shortDescription: shortDescription || null,
      description: description || null,
      image: image || null,
      icon: icon || null,
      durationText,
      durationWeeks: Number(durationWeeks) || 0,
      level,
      mode,
      eligibility: eligibility || null,
      minAge: minAge.trim() === "" ? "" : Number(minAge),
      maxAge: maxAge.trim() === "" ? "" : Number(maxAge),
      syllabus: syllabus.filter((m) => m.module.trim() || m.title.trim()).map((m, i) => ({ module: m.module.trim() || `Module ${i + 1}`, title: m.title.trim(), topics: m.topics })),
      totalClasses: Number(totalClasses) || 0,
      courseFee: Number(courseFee) || 0,
      registrationFee: Number(registrationFee) || 0,
      examFee: Number(examFee) || 0,
      certificateFee: Number(certificateFee) || 0,
      scholarshipAvailable,
      scholarshipNote: scholarshipNote || null,
      certificateEligibility: certificateEligibility || null,
      minAttendancePct: Number(minAttendancePct) || 0,
      passingMarksPct: Number(passingMarksPct) || 0,
      requiredDocuments,
      status,
      isFeatured,
      sortOrder: Number(sortOrder) || 0,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
    };
    const res = await submit(() => (initial ? api.put<{ id: string; code: string }>(`/api/admin/courses/${initial.id}`, body) : api.post<{ id: string; code: string }>("/api/admin/courses", body)), { silent: true });
    if (!res) return;
    toast.success(initial ? "Course updated" : "Course created", `${res.code} · ${name}`);
    router.push(`/admin/courses/${res.id}`);
    router.refresh();
  };

  const syllabusError = Object.entries(fieldErrors).find(([k]) => k.startsWith("syllabus"));

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {error && Object.keys(fieldErrors).length > 0 && <Alert tone="warning">{error}</Alert>}

      <FormSection title="Basics">
        <FormGrid>
          <Field label="Course name" htmlFor="co-name" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="co-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} required maxLength={160} invalid={!!fieldErrors.name} />
          </Field>
          <Field label="Course code" htmlFor="co-code" required error={fieldErrors.code} hint="2–20 uppercase letters, digits or hyphens. Shown on certificates.">
            <Input id="co-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); clearField("code"); }} required maxLength={20} className="font-mono uppercase" invalid={!!fieldErrors.code} placeholder="e.g. DIG-101" />
          </Field>
          <Field label="Category" htmlFor="co-cat" error={fieldErrors.categoryId}>
            <Select id="co-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.map((c) => ({ value: c.id, label: `${c.name}${c.isActive ? "" : " (inactive)"}` }))} placeholder="No category" invalid={!!fieldErrors.categoryId} />
          </Field>
          <Field label="Short description" htmlFor="co-short" error={fieldErrors.shortDescription} hint="One or two sentences for course cards (max 300 characters)." className="sm:col-span-2">
            <Textarea id="co-short" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} maxLength={300} />
          </Field>
          <Field label="Full description" htmlFor="co-desc" error={fieldErrors.description} className="sm:col-span-2">
            <Textarea id="co-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={20000} />
          </Field>
          <Field label="Course image" error={fieldErrors.image}>
            <ImageField value={image} onChange={setImage} folder="courses" />
          </Field>
          <Field label="Icon" htmlFor="co-icon" error={fieldErrors.icon}>
            <IconPicker id="co-icon" value={icon} onChange={setIcon} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Duration, level & eligibility">
        <FormGrid cols={3}>
          <Field label="Duration (text)" htmlFor="co-dur" required error={fieldErrors.durationText} hint="e.g. 3 months">
            <Input id="co-dur" value={durationText} onChange={(e) => { setDurationText(e.target.value); clearField("durationText"); }} required maxLength={60} invalid={!!fieldErrors.durationText} />
          </Field>
          <Field label="Duration (weeks)" htmlFor="co-weeks" error={fieldErrors.durationWeeks}>
            <Input id="co-weeks" type="number" min={0} max={520} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} invalid={!!fieldErrors.durationWeeks} />
          </Field>
          <Field label="Total classes" htmlFor="co-classes" error={fieldErrors.totalClasses} hint="Used for attendance and progress percentages.">
            <Input id="co-classes" type="number" min={0} max={2000} value={totalClasses} onChange={(e) => setTotalClasses(e.target.value)} invalid={!!fieldErrors.totalClasses} />
          </Field>
          <Field label="Level" htmlFor="co-level" error={fieldErrors.level}>
            <Select id="co-level" value={level} onChange={(e) => setLevel(e.target.value)} options={[{ value: "BEGINNER", label: "Beginner" }, { value: "INTERMEDIATE", label: "Intermediate" }, { value: "ADVANCED", label: "Advanced" }]} />
          </Field>
          <Field label="Mode" htmlFor="co-mode" error={fieldErrors.mode}>
            <Select id="co-mode" value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: "OFFLINE", label: "Offline (at center)" }, { value: "ONLINE", label: "Online" }, { value: "HYBRID", label: "Hybrid" }]} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min age" htmlFor="co-minage" error={fieldErrors.minAge}>
              <Input id="co-minage" type="number" min={5} max={100} value={minAge} onChange={(e) => { setMinAge(e.target.value); clearField("minAge"); }} invalid={!!fieldErrors.minAge} />
            </Field>
            <Field label="Max age" htmlFor="co-maxage" error={fieldErrors.maxAge}>
              <Input id="co-maxage" type="number" min={5} max={100} value={maxAge} onChange={(e) => { setMaxAge(e.target.value); clearField("maxAge"); }} invalid={!!fieldErrors.maxAge} />
            </Field>
          </div>
          <Field label="Eligibility" htmlFor="co-elig" error={fieldErrors.eligibility} className="sm:col-span-3" hint="e.g. Class 10 pass, basic reading ability.">
            <Textarea id="co-elig" value={eligibility} onChange={(e) => setEligibility(e.target.value)} rows={2} maxLength={2000} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Syllabus" description="Modules are shown on the public course page in this order.">
        {syllabusError && <Alert tone="danger">{syllabusError[1]}</Alert>}
        <div className="space-y-3">
          {syllabus.map((m, i) => (
            <div key={m.key} className="rounded-xl border border-line bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
                <Field label="Module" htmlFor={`syl-mod-${m.key}`}>
                  <Input id={`syl-mod-${m.key}`} value={m.module} onChange={(e) => updateModule(i, { module: e.target.value })} maxLength={60} placeholder={`Module ${i + 1}`} />
                </Field>
                <Field label="Title" htmlFor={`syl-title-${m.key}`}>
                  <Input id={`syl-title-${m.key}`} value={m.title} onChange={(e) => updateModule(i, { title: e.target.value })} maxLength={200} placeholder="e.g. Introduction to computers" />
                </Field>
                <div className="flex items-end gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => moveModule(i, -1)} disabled={i === 0} aria-label="Move module up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => moveModule(i, 1)} disabled={i === syllabus.length - 1} aria-label="Move module down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSyllabus((s) => s.filter((_, j) => j !== i))} aria-label="Remove module">
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
              <Field label="Topics" className="mt-3" hint="Press Enter after each topic.">
                <TagInput value={m.topics} onChange={(topics) => updateModule(i, { topics })} placeholder="Add a topic" />
              </Field>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setSyllabus((s) => [...s, mkModule(`Module ${s.length + 1}`)])} disabled={syllabus.length >= 100}>
            Add module
          </Button>
        </div>
      </FormSection>

      <FormSection title="Fees & scholarship" description={`Total payable: ₹${totalFee.toLocaleString("en-IN")}. Set every fee to 0 for a free course.`}>
        <FormGrid cols={4}>
          <Field label="Course fee (₹)" htmlFor="co-fee" error={fieldErrors.courseFee}>
            <Input id="co-fee" type="number" min={0} step="1" value={courseFee} onChange={(e) => { setCourseFee(e.target.value); clearField("courseFee"); }} invalid={!!fieldErrors.courseFee} />
          </Field>
          <Field label="Registration fee (₹)" htmlFor="co-reg" error={fieldErrors.registrationFee}>
            <Input id="co-reg" type="number" min={0} step="1" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} invalid={!!fieldErrors.registrationFee} />
          </Field>
          <Field label="Exam fee (₹)" htmlFor="co-exam" error={fieldErrors.examFee}>
            <Input id="co-exam" type="number" min={0} step="1" value={examFee} onChange={(e) => setExamFee(e.target.value)} invalid={!!fieldErrors.examFee} />
          </Field>
          <Field label="Certificate fee (₹)" htmlFor="co-cert" error={fieldErrors.certificateFee}>
            <Input id="co-cert" type="number" min={0} step="1" value={certificateFee} onChange={(e) => setCertificateFee(e.target.value)} invalid={!!fieldErrors.certificateFee} />
          </Field>
        </FormGrid>
        <Checkbox checked={scholarshipAvailable} onChange={(e) => setScholarshipAvailable(e.target.checked)} label="Scholarship available" description="Students can request a scholarship when applying for this course." />
        {scholarshipAvailable && (
          <Field label="Scholarship note" htmlFor="co-schol" error={fieldErrors.scholarshipNote} hint="Shown to students, e.g. eligibility criteria.">
            <Textarea id="co-schol" value={scholarshipNote} onChange={(e) => setScholarshipNote(e.target.value)} rows={2} maxLength={2000} />
          </Field>
        )}
      </FormSection>

      <FormSection title="Completion & certificate">
        <FormGrid cols={3}>
          <Field label="Minimum attendance (%)" htmlFor="co-att" error={fieldErrors.minAttendancePct}>
            <Input id="co-att" type="number" min={0} max={100} value={minAttendancePct} onChange={(e) => setMinAttendancePct(e.target.value)} invalid={!!fieldErrors.minAttendancePct} />
          </Field>
          <Field label="Passing marks (%)" htmlFor="co-pass" error={fieldErrors.passingMarksPct}>
            <Input id="co-pass" type="number" min={0} max={100} value={passingMarksPct} onChange={(e) => setPassingMarksPct(e.target.value)} invalid={!!fieldErrors.passingMarksPct} />
          </Field>
          <Field label="Certificate eligibility (text)" htmlFor="co-certelig" error={fieldErrors.certificateEligibility} className="sm:col-span-3">
            <Textarea id="co-certelig" value={certificateEligibility} onChange={(e) => setCertificateEligibility(e.target.value)} rows={2} maxLength={2000} placeholder="e.g. 75% attendance and a pass in the final assessment" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Required documents" description="Students must upload these before an application can be approved.">
        {documentTypes.length === 0 ? (
          <p className="text-sm text-muted">No student document types are configured. Add them under Settings → Document types.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {documentTypes.map((d) => (
              <Checkbox key={d.key} checked={requiredDocuments.includes(d.key)} onChange={() => { setRequiredDocuments((r) => (r.includes(d.key) ? r.filter((x) => x !== d.key) : [...r, d.key])); clearField("requiredDocuments"); }} label={d.name} description={d.description ?? (d.isRequired ? "Marked required by default" : undefined)} className="rounded-xl border border-line bg-white p-3" />
            ))}
          </div>
        )}
        {fieldErrors.requiredDocuments && <p className="text-xs font-medium text-danger">{fieldErrors.requiredDocuments}</p>}
      </FormSection>

      <FormSection title="Publishing & SEO">
        <FormGrid cols={3}>
          <Field label="Status" htmlFor="co-status" error={fieldErrors.status} hint="Only active courses appear on the website and in applications.">
            <Select id="co-status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }]} />
          </Field>
          <Field label="Sort order" htmlFor="co-sort" error={fieldErrors.sortOrder}>
            <Input id="co-sort" type="number" min={0} max={10000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} label="Featured" description="Highlight on the home page." />
          </div>
          <Field label="SEO title" htmlFor="co-seot" error={fieldErrors.seoTitle} className="sm:col-span-3">
            <Input id="co-seot" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={160} placeholder={name ? `${name} – EduSkill India Foundation` : undefined} />
          </Field>
          <Field label="SEO description" htmlFor="co-seod" error={fieldErrors.seoDescription} className="sm:col-span-3">
            <Textarea id="co-seod" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={320} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" onClick={() => router.push(initial ? `/admin/courses/${initial.id}` : "/admin/courses")} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Create course"}
        </Button>
      </FormActions>
    </form>
  );
}
