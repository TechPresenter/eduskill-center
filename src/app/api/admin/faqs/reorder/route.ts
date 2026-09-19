import { apiHandler, parseBody } from "@/lib/api/handler";
import { reorderSchema } from "@/server/cms-admin";
import { reorderFaqs } from "@/server/content";

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, reorderSchema);
  await reorderFaqs(body.ids, { user: user!, ip, userAgent });
  return { ok: true };
});
