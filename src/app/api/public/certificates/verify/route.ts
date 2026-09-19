import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { verifyCertificate } from "@/server/certificates";
import { hashIp } from "@/server/analytics";

const schema = z.object({ no: z.string().trim().min(4).max(60) });

/** GET /api/public/certificates/verify?no=ESK-CERT-2026-000001 → public certificate details or 404. */
export const GET = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 30, windowSec: 60, name: "public-verify" } }, async ({ req, ip }) => {
  const { no } = parseQuery(req, schema);
  const cert = await verifyCertificate(no, { ip: hashIp(ip) });
  if (!cert) throw Errors.notFound("Certificate");
  return cert;
});
