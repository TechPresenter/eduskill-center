import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteProgram, programSchema, updateProgram } from "@/server/cms-admin";

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, programSchema);
  return updateProgram(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteProgram(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
