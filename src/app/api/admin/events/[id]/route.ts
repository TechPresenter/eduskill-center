import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteEvent, eventSchema, updateEvent } from "@/server/content";

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, eventSchema);
  return updateEvent(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteEvent(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
