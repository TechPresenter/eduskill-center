import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { verifyTrainerDocument } from "@/server/trainers";

const schema = z
  .object({ status: z.enum(["VERIFIED", "REJECTED"]), remarks: z.string().trim().max(500).optional().nullable() })
  .superRefine((d, ctx) => {
    if (d.status === "REJECTED" && !d.remarks) ctx.addIssue({ code: "custom", path: ["remarks"], message: "Explain why the document was rejected" });
  });

export const PATCH = apiHandler<{ docId: string }>({ permission: "trainers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return verifyTrainerDocument(params.docId, body.status, body.remarks ?? null, { user: user!, ip, userAgent });
});
