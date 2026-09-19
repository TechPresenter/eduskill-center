import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { assignTrainer } from "@/server/trainers";

const schema = z.object({
  trainerId: z.string().uuid("Select a trainer"),
  courseId: z.union([z.literal(""), z.string().uuid()]).optional().nullable(),
  batchId: z.union([z.literal(""), z.string().uuid()]).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

/** Assigns an active trainer to this center (optionally for a course or batch). */
export const POST = apiHandler<{ id: string }>({ permission: "trainers.assign" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return assignTrainer({ trainerId: body.trainerId, centerId: params.id, courseId: body.courseId || null, batchId: body.batchId || null, notes: body.notes || null }, { user: user!, ip, userAgent });
});
