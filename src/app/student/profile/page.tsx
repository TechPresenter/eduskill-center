import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { getStudentProfile } from "@/server/students";
import { db } from "@/lib/db";
import { dateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { ProfileForm, type ProfileFormValues } from "@/components/student/profile-form";
import { ProfileHub, profileCompletionPct } from "@/components/student/mobile";

export const metadata: Metadata = { title: "My Profile" };

export default async function StudentProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireStudent();
  const { welcome } = await searchParams;
  const [s, unread] = await Promise.all([getStudentProfile(user.student.id), db.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } })]);

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

  const documentsPending = s.documents.filter((d) => d.status === "PENDING" || d.status === "REJECTED").length;
  const location = [s.villageTown, s.block?.name, s.district?.name, s.state?.name].filter(Boolean).join(", ") || null;

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="My Profile" mobileTitle="Profile" description="Keep your details up to date – they are used on your application, ID card and certificate." />

      {/* Phone: account hub. Desktop keeps the full form as before. */}
      <div className="lg:hidden">
        <ProfileHub
          name={s.name}
          studentId={s.studentId}
          photoUrl={s.photoUrl ?? user.avatarUrl}
          mobile={s.mobile}
          email={s.email ?? s.user.email}
          location={location}
          qualification={s.qualification}
          completion={profileCompletionPct(s)}
          profileCompleted={s.profileCompleted}
          documentsPending={documentsPending}
          unreadNotifications={unread}
          welcome={welcome === "1"}
        />
      </div>

      <div className="hidden lg:block">
        <ProfileForm initial={initial} profileCompleted={s.profileCompleted} studentCode={s.studentId} welcome={welcome === "1"} />
      </div>
    </div>
  );
}
