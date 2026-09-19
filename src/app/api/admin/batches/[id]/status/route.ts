import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { updateBatch } from "@/server/batches";

const schema = z.object({ status: z.enum(["UPCOMING", "ONGOING", "CANCELLED"]) });

/** Marks a batch ONGOING / UPCOMING / CANCELLED. Completion goes through /complete. */
export const PATCH = apiHandler<{ id: string }>({ permission: "batches.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const batch = await db.batch.findFirst({ where: { id: params.id, deletedAt: null }, select: { status: true } });
  if (!batch) throw Errors.notFound("Batch");
  if (batch.status === "COMPLETED") throw Errors.badRequest("A completed batch cannot change status.");
  return updateBatch(params.id, { status: body.status }, { user: user!, ip, userAgent });
});
