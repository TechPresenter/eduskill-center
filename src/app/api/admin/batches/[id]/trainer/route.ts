import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { assignTrainer } from "@/server/trainers";

const schema = z.object({ trainerId: z.string().uuid("Select a trainer"), notes: z.string().trim().max(500).optional().nullable() });

/** Assigns (or changes) the trainer of a batch through the trainer assignment service. */
export const PATCH = apiHandler<{ id: string }>({ permission: ["batches.update", "trainers.assign"] }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const batch = await db.batch.findFirst({ where: { id: params.id, deletedAt: null }, select: { centerId: true, status: true } });
  if (!batch) throw Errors.notFound("Batch");
  if (batch.status === "COMPLETED" || batch.status === "CANCELLED") throw Errors.badRequest("Trainer cannot be changed on a completed or cancelled batch.");
  return assignTrainer({ trainerId: body.trainerId, centerId: batch.centerId, batchId: params.id, notes: body.notes || null }, { user: user!, ip, userAgent });
});
