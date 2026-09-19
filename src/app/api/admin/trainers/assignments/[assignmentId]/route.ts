import { apiHandler } from "@/lib/api/handler";
import { endAssignment } from "@/server/trainers";

/** Ends an active assignment (keeps the history row). */
export const DELETE = apiHandler<{ assignmentId: string }>({ permission: "trainers.assign" }, async ({ params, user, ip, userAgent }) => {
  await endAssignment(params.assignmentId, { user: user!, ip, userAgent });
  return { ok: true };
});
