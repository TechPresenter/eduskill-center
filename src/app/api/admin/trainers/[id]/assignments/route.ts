import { apiHandler, parseBody } from "@/lib/api/handler";
import { trainerAssignmentSchema } from "@/lib/validation/trainers";
import { assignTrainer } from "@/server/trainers";

export const POST = apiHandler<{ id: string }>({ permission: "trainers.assign" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, trainerAssignmentSchema.omit({ trainerId: true }));
  return assignTrainer({ trainerId: params.id, centerId: body.centerId, courseId: body.courseId || null, batchId: body.batchId || null, notes: body.notes ?? null }, { user: user!, ip, userAgent });
});
