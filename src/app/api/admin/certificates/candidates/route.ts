import { apiHandler, parseQuery } from "@/lib/api/handler";
import { optionalUuid, paginationSchema } from "@/lib/api/query";
import { listCertificateCandidates } from "@/server/certificates";
import { progressNumbers } from "@/server/admissions";

const schema = paginationSchema.extend({ centerId: optionalUuid, courseId: optionalUuid, batchId: optionalUuid });

/** Admissions eligible for a certificate that do not have one yet. */
export const GET = apiHandler({ permission: "certificates.view" }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const res = await listCertificateCandidates(q);
  return { ...res, items: res.items.map((a) => ({ ...a, progress: progressNumbers(a.progress) })) };
});

