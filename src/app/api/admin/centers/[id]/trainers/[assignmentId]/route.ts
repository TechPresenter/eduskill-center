import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { endAssignment } from "@/server/trainers";

/** Ends an active trainer assignment at this center. */
export const DELETE = apiHandler<{ id: string; assignmentId: string }>({ permission: "trainers.assign" }, async ({ params, user, ip, userAgent }) => {
  const a = await db.trainerAssignment.findFirst({ where: { id: params.assignmentId, centerId: params.id } });
  if (!a) throw Errors.notFound("Assignment");
  await endAssignment(params.assignmentId, { user: user!, ip, userAgent });
  return { ended: true };
});
