import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteTemplate, getTemplate, saveTemplate, templateSchema } from "@/server/notifications-admin";

export const GET = apiHandler<{ key: string }>({ permission: ["notifications.view", "notifications.templates"] }, async ({ params }) => getTemplate(decodeURIComponent(params.key)));

export const PUT = apiHandler<{ key: string }>({ permission: "notifications.templates" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, templateSchema);
  return saveTemplate(decodeURIComponent(params.key), body, { user: user!, ip, userAgent });
});

/** Removes the custom template so the built-in default is used again. */
export const DELETE = apiHandler<{ key: string }>({ permission: "notifications.templates" }, async ({ params, user, ip, userAgent }) => {
  await deleteTemplate(decodeURIComponent(params.key), { user: user!, ip, userAgent });
  return { ok: true };
});
