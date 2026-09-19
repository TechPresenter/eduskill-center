import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { requestDocuments } from "@/server/applications";

const schema = z.object({ note: z.string().trim().min(5, "Describe which documents are needed").max(2000) });

export const POST = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await requestDocuments(params.id, body.note, { user: user!, ip, userAgent });
  return { status: "DOCUMENTS_REQUIRED" };
});
