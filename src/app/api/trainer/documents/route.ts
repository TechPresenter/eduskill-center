import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { myTrainerDocuments, trainerDocumentTypes, trainerOf, uploadMyTrainerDocument } from "@/server/trainer-scope";

/** GET /api/trainer/documents – the Foundation's trainer document types and everything I have on file. */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ user }) => {
  const t = trainerOf(user);
  const [types, documents] = await Promise.all([trainerDocumentTypes(), myTrainerDocuments(t.id)]);
  return { types, documents };
});

/**
 * POST /api/trainer/documents   multipart { type, file }
 * Uploads (or replaces) one of my documents. Stored privately under private/trainers/<myId>/documents,
 * filed as a PENDING TrainerDocument on my trainer record, audited, and the Foundation is alerted.
 * Allowed while inactive too: documents are how a trainer gets their record put right.
 */
export const POST = apiHandler({ roles: ["TRAINER"], rateLimit: { limit: 20, windowSec: 60 * 60, keyBy: "user", name: "trainer-portal-doc-upload" } }, async ({ req, user, ip, userAgent }) => {
  trainerOf(user);
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const type = String(fd.get("type") ?? "").trim();
  return uploadMyTrainerDocument(user!, type, file, { ip, userAgent });
});
