import { apiHandler, parseBody } from "@/lib/api/handler";
import { studentProfileSchema } from "@/lib/validation/students";
import { getStudentProfile, updateStudentProfile } from "@/server/students";

/** GET /api/student/profile – the logged-in student's own profile. */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ user }) => {
  return getStudentProfile(user!.student!.id);
});

/** PUT /api/student/profile – full profile update (marks the profile as completed). */
export const PUT = apiHandler({ roles: ["STUDENT"] }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, studentProfileSchema);
  const updated = await updateStudentProfile(user!.student!.id, body, { id: user!.id, name: user!.name, role: user!.role }, { ip, userAgent });
  return { id: updated.id, profileCompleted: updated.profileCompleted, photoUrl: updated.photoUrl, name: updated.name };
});
