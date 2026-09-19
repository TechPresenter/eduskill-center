import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { attachCentreDocument } from "@/server/centre-applications";
import { assertUploadTokenFor } from "@/server/trainer-upload-token";
import { CENTRE_IMAGE_DOCUMENT_TYPES, CENTRE_UPLOAD_CLOSED_STATUSES, centreDocumentType } from "@/app/(site)/open-a-centre/centre-documents";

/**
 * POST /api/public/centre-applications/[id]/documents   multipart { type, file, token }
 * Centre applicant document upload, authorised by the signed upload token issued on submit / lookup.
 * Files are stored privately and served only through /api/files with access control.
 */
export const POST = apiHandler<{ id: string }>({ auth: "none", rateLimit: { limit: 30, windowSec: 60 * 60, name: "centre-doc-upload" } }, async ({ req, params }) => {
  const { id } = params;
  if (!isUuid(id)) throw Errors.notFound("Application");
  const fd = await req.formData();
  assertUploadTokenFor(fd.get("token"), id);

  const app = await db.centreApplication.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!app) throw Errors.notFound("Application");
  if (CENTRE_UPLOAD_CLOSED_STATUSES.includes(app.status)) throw Errors.badRequest("Documents can no longer be added to this application.");

  const type = String(fd.get("type") ?? "").trim();
  const docType = centreDocumentType(type);
  if (!docType) throw Errors.badRequest("Unknown document type");

  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const stored = await saveUpload(file, {
    folder: `centres/${id}`,
    visibility: "private",
    preset: CENTRE_IMAGE_DOCUMENT_TYPES.includes(type) ? "image" : "document",
    maxMb: docType.maxMb,
  });
  const doc = await attachCentreDocument(id, type, stored);
  return {
    key: stored.key,
    url: stored.url,
    name: stored.name,
    mimeType: stored.mimeType,
    size: stored.size,
    documentId: doc.id,
    type: doc.type,
    status: doc.status,
    createdAt: doc.createdAt,
  };
});
