import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { getStudentProfile } from "@/server/students";
import { dateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { ProfileForm, type ProfileFormValues } from "@/components/student/profile-form";

export const metadata: Metadata = { title: "Edit Profile" };

/** Full profile form. The phone profile screen (/student/profile) links here per section (#personal …). */
export default async function StudentProfileEditPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireStudent();
  const { welcome } = await searchParams;
  const s = await getStudentProfile(user.student.id);

  const initial: ProfileFormValues = {
    name: s.name ?? "",
    guardianName: s.guardianName ?? "",
    guardianRelation: s.guardianRelation ?? "",
    dob: dateInputValue(s.dob),
    gender: s.gender ?? "",
    mobile: s.mobile ?? "",
    whatsapp: s.whatsapp ?? "",
    email: s.email ?? s.user.email ?? "",
    photoUrl: s.photoUrl ?? "",
    stateId: s.stateId ?? "",
    districtId: s.districtId ?? "",
    blockId: s.blockId ?? "",
    villageTown: s.villageTown ?? "",
    address: s.address ?? "",
    pincode: s.pincode ?? "",
    qualification: s.qualification ?? "",
    institution: s.institution ?? "",
    passingYear: s.passingYear ? String(s.passingYear) : "",
    familyIncome: s.familyIncome ?? "",
    occupation: s.occupation ?? "",
    areaType: s.areaType ?? "",
    trainingRequirement: s.trainingRequirement ?? "",
    scholarshipRequired: s.scholarshipRequired,
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Edit profile"
        mobileTitle="Edit profile"
        backHref="/student/profile"
        breadcrumbs={[{ label: "My Profile", href: "/student/profile" }, { label: "Edit" }]}
        description="Everything marked with * is required before you can apply for a course."
      />
      <ProfileForm initial={initial} profileCompleted={s.profileCompleted} studentCode={s.studentId} welcome={welcome === "1"} />
    </div>
  );
}
