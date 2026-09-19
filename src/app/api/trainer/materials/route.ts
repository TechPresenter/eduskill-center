import { apiHandler, parseQuery } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { saveUpload } from "@/lib/storage";
import { assertBatchAccess } from "@/server/attendance";
import { createMaterial, listMaterials, materialSchema, materialsQuery } from "@/server/coursework";
import { assertActiveTrainer, myBatchIds, trainerOf } from "@/server/trainer-scope";

/**
 * GET /api/trainer/materials?page=&limit=&batchId= → `{ items, meta }` of study materials I uploaded for my batches
 * (newest first, 30 per page by default). `batchId` outside my scope simply yields an empty page.
 */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  const t = trainerOf(user);
  const q = parseQuery(req, materialsQuery);
  const batchIds = await myBatchIds(t.id);
  return listMaterials({ batchIds, uploadedById: user!.id, batchId: q.batchId, page: q.page, limit: q.limit });
});

/** POST /api/trainer/materials   multipart { batchId, title, description?, file } */
export const POST = apiHandler({ roles: ["TRAINER"], rateLimit: { limit: 60, windowSec: 600, keyBy: "user", name: "trainer-material" } }, async ({ req, user, ip, userAgent }) => {
  assertActiveTrainer(user);
  const fd = await req.formData();
  const input = materialSchema.parse({ batchId: fd.get("batchId"), title: fd.get("title"), description: fd.get("description") ?? null });
  await assertBatchAccess(user!, input.batchId, "progress.update");
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const stored = await saveUpload(file, { folder: `materials/${input.batchId}`, visibility: "private", preset: "material" });
  return createMaterial(input, stored, user!, { ip, userAgent });
});
