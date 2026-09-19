import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { verifyCentreDocument } from "@/server/centre-applications";

const schema = z
  .object({ status: z.enum(["VERIFIED", "REJECTED"]), remarks: z.string().trim().max(500).optional().nullable() })
  .superRefine((d, ctx) => {
    if (d.status === "REJECTED" && !d.remarks) ctx.addIssue({ code: "custom", path: ["remarks"], message: "Explain why the document was rejected" });
  });

/** Step 2 – Documents Verification: verifies or rejects one uploaded document. */
const handler = apiHandler<{ id: string; docId: string }>({ permission: "centre_applications.verify" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const doc = await verifyCentreDocument(params.docId, body.status, body.remarks ?? null, { user: user!, ip, userAgent });
  return { id: doc.id, status: doc.status, remarks: doc.remarks, verifiedAt: doc.verifiedAt };
});

export const POST = handler;
export const PATCH = handler;
