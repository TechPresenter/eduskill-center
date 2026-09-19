import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { saveUpload } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { uploadStudentDocument } from "@/server/students";
import { listStudentDocumentTypes } from "@/server/student-portal";

/** GET /api/student/documents – the student's documents and the active document types. */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ user }) => {
  const studentId = user!.student!.id;
  const [types, documents] = await Promise.all([listStudentDocumentTypes(), db.studentDocument.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } })]);
  return { types, documents };
});

const fieldsSchema = z.object({
  type: z.string().trim().min(1, "Select a document type").max(60),
  applicationId: z.union([z.literal(""), z.string().uuid()]).optional().nullable(),
});

/**
 * POST /api/student/documents (multipart: type, file, applicationId?)
 * Stores the file privately under students/<studentId>/ and replaces any earlier pending / rejected upload of the same type.
 */
export const POST = apiHandler({ roles: ["STUDENT"], rateLimit: { limit: 60, windowSec: 600, keyBy: "user", name: "student-document" } }, async ({ req, user }) => {
  const studentId = user!.student!.id;
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const fields = fieldsSchema.parse({ type: fd.get("type") ?? "", applicationId: fd.get("applicationId") ?? "" });

  const docType = await db.documentType.findFirst({ where: { key: fields.type, appliesTo: "STUDENT", isActive: true } });
  if (!docType) throw Errors.badRequest("Unknown document type");

  let applicationId: string | null = null;
  if (fields.applicationId && isUuid(fields.applicationId)) {
    const app = await db.application.findFirst({ where: { id: fields.applicationId, studentId }, select: { id: true } });
    if (!app) throw Errors.notFound("Application");
    applicationId = app.id;
  }

  const isPhoto = fields.type === "photo";
  const stored = await saveUpload(file, { folder: isPhoto ? `students/${studentId}/photo` : `students/${studentId}`, visibility: "private", preset: isPhoto ? "image" : "document" });
  const doc = await uploadStudentDocument(studentId, fields.type, stored, applicationId);
  if (isPhoto) await db.user.update({ where: { id: user!.id }, data: { avatarUrl: stored.url } }).catch(() => undefined);
  return { ...stored, document: doc };
});
