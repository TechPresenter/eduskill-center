import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { getStudentProfile } from "@/server/students";
import { listStudentApplications } from "@/server/student-portal";
import { dateInputValue, isUuid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { ApplyWizard, type DraftApplicationInfo } from "@/components/student/apply-wizard";
import type { ProfileFormValues } from "@/components/student/profile-form";

export const metadata: Metadata = { title: "Find a Center & Apply" };

export default async function StudentApplyPage({ searchParams }: { searchParams: Promise<{ centerId?: string; courseId?: string }> }) {
  const user = await requireStudent();
  const { centerId, courseId } = await searchParams;
  const [admissionsOpen, courses, student, applications] = await Promise.all([
    getSetting<boolean>("admissions.open"),
    db.course.findMany({ where: { status: "ACTIVE", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    getStudentProfile(user.student.id),
    listStudentApplications(user.student.id),
  ]);

  // DECISION 4: resume the student's existing DRAFT instead of ever creating a second one.
  const draft = applications.find((a) => a.status === "DRAFT");
  const draftApplication: DraftApplicationInfo | null = draft
    ? {
        id: draft.id,
        applicationNo: draft.applicationNo,
        centerId: draft.centerId,
        courseId: draft.courseId,
        batchId: draft.batchId,
        scholarshipRequested: draft.scholarshipRequested,
        scholarshipReason: draft.scholarshipReason,
      }
    : null;

  const profile: ProfileFormValues = {
    name: student.name ?? "",
    guardianName: student.guardianName ?? "",
    guardianRelation: student.guardianRelation ?? "",
    dob: dateInputValue(student.dob),
    gender: student.gender ?? "",
    mobile: student.mobile ?? "",
    whatsapp: student.whatsapp ?? "",
    email: student.email ?? student.user.email ?? "",
    photoUrl: student.photoUrl ?? "",
    stateId: student.stateId ?? "",
    districtId: student.districtId ?? "",
    blockId: student.blockId ?? "",
    villageTown: student.villageTown ?? "",
    address: student.address ?? "",
    pincode: student.pincode ?? "",
    qualification: student.qualification ?? "",
    institution: student.institution ?? "",
    passingYear: student.passingYear ? String(student.passingYear) : "",
    familyIncome: student.familyIncome ?? "",
    occupation: student.occupation ?? "",
    areaType: student.areaType ?? "",
    trainingRequirement: student.trainingRequirement ?? "",
    scholarshipRequired: student.scholarshipRequired,
  };

  return (
    <div>
      <PageHeader
        title="Apply for a Course"
        mobileTitle="Apply"
        backHref="/student/dashboard"
        description={draftApplication ? `Continue application ${draftApplication.applicationNo} – your details, center, course, documents and fees in ten short steps.` : "Your details, a training center near you, the course and batch, documents and fees – in ten short steps. You can save and continue later at any time."}
      />
      <ApplyWizard
        studentId={user.student.id}
        profile={profile}
        profileCompleted={student.profileCompleted}
        admissionsOpen={admissionsOpen}
        courseOptions={courses}
        initialCenterId={isUuid(centerId) ? centerId : undefined}
        initialCourseId={isUuid(courseId) ? courseId : undefined}
        draftApplication={draftApplication}
      />
    </div>
  );
}
