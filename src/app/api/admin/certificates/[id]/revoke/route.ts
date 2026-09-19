import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { revokeCertificate } from "@/server/certificates";

const schema = z.object({ reason: z.string().trim().min(5, "Enter the reason for revocation").max(1000) });

export const POST = apiHandler<{ id: string }>({ permission: "certificates.revoke" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const cert = await revokeCertificate(params.id, body.reason, { user: user!, ip, userAgent });
  return { status: cert.status, revokedAt: cert.revokedAt };
});
