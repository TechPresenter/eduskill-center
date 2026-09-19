import { apiHandler, parseQuery } from "@/lib/api/handler";
import { certificateListSchema, listCertificates } from "@/server/certificates";

export const GET = apiHandler({ permission: "certificates.view" }, async ({ req }) => {
  const q = parseQuery(req, certificateListSchema);
  return listCertificates(q);
});
