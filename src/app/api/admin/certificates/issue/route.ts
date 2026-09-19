import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { optionalDateString } from "@/lib/validation/common";
import { issueCertificate } from "@/server/certificates";

const schema = z
  .object({
    admissionId: z.string().uuid().optional(),
    admissionIds: z.array(z.string().uuid()).max(100).optional(),
    grade: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(10).nullable()).optional(),
    force: z.boolean().optional(),
    completionDate: optionalDateString,
  })
  .refine((v) => v.admissionId || (v.admissionIds && v.admissionIds.length > 0), { message: "Select at least one admission", path: ["admissionId"] });

/**
 * Issues one certificate (`admissionId`) or several (`admissionIds`). `force` bypasses the eligibility check
 * for a single admission only. Bulk results list per-admission success / failure so partial runs are visible.
 */
export const POST = apiHandler({ permission: "certificates.issue" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const ctx = { user: user!, ip, userAgent };
  if (body.admissionId && !body.admissionIds) {
    const cert = await issueCertificate(body.admissionId, ctx, { grade: body.grade ?? null, force: !!body.force, completionDate: body.completionDate ?? null });
    return { issued: 1, failed: 0, results: [{ admissionId: body.admissionId, ok: true, certificateId: cert.id, certificateNo: cert.certificateNo }] };
  }
  const ids = [...new Set([...(body.admissionIds ?? []), ...(body.admissionId ? [body.admissionId] : [])])];
  const results: { admissionId: string; ok: boolean; certificateId?: string; certificateNo?: string; error?: string }[] = [];
  for (const admissionId of ids) {
    try {
      const cert = await issueCertificate(admissionId, ctx, { grade: body.grade ?? null, force: false });
      results.push({ admissionId, ok: true, certificateId: cert.id, certificateNo: cert.certificateNo });
    } catch (err) {
      results.push({ admissionId, ok: false, error: err instanceof ApiError ? err.message : "Could not issue certificate" });
    }
  }
  return { issued: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
});
