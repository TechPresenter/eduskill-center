import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { availableBatches } from "@/server/batches";
import { changeAdmissionBatch } from "@/server/admissions";

/** Open batches of the admission's center and course with live seat availability. */
export const GET = apiHandler<{ id: string }>({ permission: "admissions.view" }, async ({ params }) => {
  const adm = await db.admission.findUnique({ where: { id: params.id }, select: { centerId: true, courseId: true, batchId: true } });
  if (!adm) throw Errors.notFound("Admission");
  const batches = await availableBatches(adm.centerId, adm.courseId);
  return { currentBatchId: adm.batchId, batches };
});

const schema = z.object({ batchId: z.string().uuid("Select a batch"), note: optionalString });

/** Move the student to another batch (seat-checked inside a row-locked transaction). */
export const PUT = apiHandler<{ id: string }>({ permission: "admissions.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const updated = await changeAdmissionBatch(params.id, { batchId: body.batchId, note: body.note ?? null }, { user: user!, ip, userAgent });
  return { batchId: updated.batchId, trainerId: updated.trainerId };
});
