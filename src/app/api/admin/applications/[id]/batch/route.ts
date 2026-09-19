import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { availableBatches } from "@/server/batches";
import { assignBatch } from "@/server/applications";

/** Open batches (with live seat counts) for the application's center and course. */
export const GET = apiHandler<{ id: string }>({ permission: "applications.view" }, async ({ params }) => {
  const app = await db.application.findUnique({ where: { id: params.id }, select: { centerId: true, courseId: true, batchId: true } });
  if (!app) throw Errors.notFound("Application");
  const batches = await availableBatches(app.centerId, app.courseId);
  return { currentBatchId: app.batchId, batches };
});

const schema = z.object({ batchId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid("Select a batch").nullable()) });

/** Assign or change the batch before admission is confirmed (seat-checked once the application reserves a seat). */
export const PUT = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const updated = await assignBatch(params.id, body.batchId, { user: user!, ip, userAgent });
  return { batchId: updated.batchId, batch: updated.batch ? { id: updated.batch.id, code: updated.batch.code, name: updated.batch.name } : null };
});
