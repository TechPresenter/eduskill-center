import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listStudents, studentListSchema } from "@/server/students";
import { collectAll, csvResponse } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

/** CSV export of the student directory using the same filters as the list. */
export const GET = apiHandler({ permission: "students.export" }, async ({ req }) => {
  const q = parseQuery(req, studentListSchema);
  const rows = await collectAll(listStudents, q);
  return csvResponse(
    `students-${formatDate(new Date(), "yyyy-MM-dd")}.csv`,
    ["Student ID", "Name", "Mobile", "Email", "Gender", "Date of birth", "Guardian", "State", "District", "Block", "Village / Town", "Pincode", "Qualification", "Family income", "Area", "Applications", "Admissions", "Certificates", "Account status", "Profile completed", "Registered on"],
    rows.map((s) => [
      s.studentId,
      s.name,
      s.mobile,
      s.email,
      s.gender,
      s.dob,
      s.guardianName,
      s.state?.name,
      s.district?.name,
      s.block?.name,
      s.villageTown,
      s.pincode,
      s.qualification,
      s.familyIncome,
      s.areaType,
      s._count.applications,
      s._count.admissions,
      s._count.certificates,
      s.user.status,
      s.profileCompleted,
      s.createdAt,
    ])
  );
});
