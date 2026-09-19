import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { saveUpload } from "@/lib/storage";
import { uploadStudentDocument } from "@/server/students";

const querySchema = z.object({ kind: z.enum(["photo", "assignment", "payment-proof"]).default("photo") });

/**
 * POST /api/student/uploads?kind=photo|assignment|payment-proof  (multipart: file)
 * Private uploads under students/<studentId>/… served through /api/files with ownership checks.
 *  - photo: profile photo (image preset, folder students/<id>/photo). Also registered as the "photo" document.
 *  - assignment: attachment for an assignment submission (document preset).
 *  - payment-proof: proof of an offline payment (document preset).
 */
export const POST = apiHandler({ roles: ["STUDENT"], rateLimit: { limit: 60, windowSec: 600, keyBy: "user", name: "student-upload" } }, async ({ req, user }) => {
  const { kind } = parseQuery(req, querySchema);
  const studentId = user!.student!.id;
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");

  if (kind === "photo") {
    const stored = await saveUpload(file, { folder: `students/${studentId}/photo`, visibility: "private", preset: "image" });
    const photoType = await db.documentType.findFirst({ where: { key: "photo", appliesTo: "STUDENT", isActive: true }, select: { id: true } });
    if (photoType) await uploadStudentDocument(studentId, "photo", stored);
    else await db.student.update({ where: { id: studentId }, data: { photoUrl: stored.url } });
    await db.user.update({ where: { id: user!.id }, data: { avatarUrl: stored.url } });
    return stored;
  }
  if (kind === "assignment") {
    return saveUpload(file, { folder: `students/${studentId}/assignments`, visibility: "private", preset: "material", maxMb: 20 });
  }
  return saveUpload(file, { folder: `students/${studentId}/payments`, visibility: "private", preset: "document" });
});
