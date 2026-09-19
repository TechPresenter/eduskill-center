import { apiHandler, parseBody } from "@/lib/api/handler";
import { reorderPrograms, reorderSchema } from "@/server/cms-admin";

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, reorderSchema);
  await reorderPrograms(body.ids, { user: user!, ip, userAgent });
  return { ok: true };
});
