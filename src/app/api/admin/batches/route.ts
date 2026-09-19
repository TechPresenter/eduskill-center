import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createBatch } from "@/server/batches";
import { batchInputSchema, batchListSchema, listBatchesAdmin } from "@/app/admin/batches/queries";

export const GET = apiHandler({ permission: "batches.view" }, async ({ req }) => listBatchesAdmin(parseQuery(req, batchListSchema)));

export const POST = apiHandler({ permission: "batches.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, batchInputSchema);
  return createBatch({ ...body, trainerId: body.trainerId || null, room: body.room || null, notes: body.notes || null }, { user: user!, ip, userAgent });
});
