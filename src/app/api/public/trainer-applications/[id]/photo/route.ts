import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { deleteStoredFile, keyFromUrl, saveUpload } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { assertUploadTokenFor } from "@/server/trainer-upload-token";

/**
 * POST /api/public/trainer-applications/[id]/photo   multipart { file, token }
 * Sets the applicant's passport photo (private image; becomes the trainer avatar on approval).
 */
export const POST = apiHandler<{ id: string }>({ auth: "none", rateLimit: { limit: 10, windowSec: 60 * 60, name: "trainer-photo-upload" } }, async ({ req, params }) => {
  const { id } = params;
  if (!isUuid(id)) throw Errors.notFound("Application");
  const fd = await req.formData();
  assertUploadTokenFor(fd.get("token"), id);

  const app = await db.trainerApplication.findUnique({ where: { id }, select: { id: true, status: true, photoUrl: true } });
  if (!app) throw Errors.notFound("Application");
  if (app.status === "APPROVED" || app.status === "REJECTED") throw Errors.badRequest("This application can no longer be changed.");

  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const stored = await saveUpload(file, { folder: `trainers/${id}/photo`, visibility: "private", preset: "image", maxMb: 2 });
  await db.trainerApplication.update({ where: { id }, data: { photoUrl: stored.url } });
  const oldKey = keyFromUrl(app.photoUrl);
  if (oldKey && oldKey.startsWith(`private/trainers/${id}/photo/`)) await deleteStoredFile(oldKey).catch(() => undefined);
  return { key: stored.key, url: stored.url, name: stored.name, mimeType: stored.mimeType, size: stored.size };
});
