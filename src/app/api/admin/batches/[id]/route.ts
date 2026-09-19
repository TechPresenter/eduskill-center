import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteBatch, updateBatch } from "@/server/batches";
import { batchInputSchema, getBatchAdmin } from "@/app/admin/batches/queries";

export const GET = apiHandler<{ id: string }>({ permission: "batches.view" }, async ({ params }) => getBatchAdmin(params.id));

export const PUT = apiHandler<{ id: string }>({ permission: "batches.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, batchInputSchema);
  return updateBatch(params.id, { ...body, trainerId: body.trainerId || null, room: body.room || null, notes: body.notes || null }, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "batches.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteBatch(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
