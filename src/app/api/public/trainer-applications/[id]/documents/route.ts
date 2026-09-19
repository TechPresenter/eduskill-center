import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { attachTrainerDocument } from "@/server/trainers";
import { assertUploadTokenFor } from "@/server/trainer-upload-token";

const TERMINAL = ["APPROVED", "REJECTED"];

/**
 * POST /api/public/trainer-applications/[id]/documents   multipart { type, file, token }
 * Applicant document upload, authorised by the signed upload token issued on submit / lookup.
 */
export const POST = apiHandler<{ id: string }>({ auth: "none", rateLimit: { limit: 30, windowSec: 60 * 60, name: "trainer-doc-upload" } }, async ({ req, params }) => {
  const { id } = params;
  if (!isUuid(id)) throw Errors.notFound("Application");
  const fd = await req.formData();
  assertUploadTokenFor(fd.get("token"), id);

  const app = await db.trainerApplication.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!app) throw Errors.notFound("Application");
  if (TERMINAL.includes(app.status)) throw Errors.badRequest("Documents can no longer be added to this application.");

  const type = String(fd.get("type") ?? "").trim();
  if (!type || !/^[a-z0-9_]+$/.test(type)) throw Errors.badRequest("Select a document type");
  const docType = await db.documentType.findFirst({ where: { key: type, appliesTo: "TRAINER", isActive: true } });
  if (!docType) throw Errors.badRequest("Unknown document type");

  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const stored = await saveUpload(file, { folder: `trainers/${id}`, visibility: "private", preset: type === "resume" ? "resume" : "document" });
  const doc = await attachTrainerDocument(id, type, stored);
  return { key: stored.key, url: stored.url, name: stored.name, mimeType: stored.mimeType, size: stored.size, documentId: doc.id, type: doc.type, status: doc.status, createdAt: doc.createdAt };
});
