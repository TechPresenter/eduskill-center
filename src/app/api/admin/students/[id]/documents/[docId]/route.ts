import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { verifyStudentDocument } from "@/server/students";

const documentDecisionSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  remarks: optionalString,
}).superRefine((v, ctx) => {
  if (v.status === "REJECTED" && !v.remarks?.trim()) ctx.addIssue({ code: "custom", path: ["remarks"], message: "Tell the student why the document was rejected" });
});

/** Verify or reject a student's uploaded document. */
export const POST = apiHandler<{ id: string; docId: string }>({ permission: ["students.update", "applications.update"] }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, documentDecisionSchema);
  const doc = await db.studentDocument.findFirst({ where: { id: params.docId, studentId: params.id }, select: { id: true } });
  if (!doc) throw Errors.notFound("Document");
  return verifyStudentDocument(params.docId, body.status, body.remarks, { user: user!, ip, userAgent });
});
