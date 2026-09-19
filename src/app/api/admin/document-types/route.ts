import { apiHandler, parseBody } from "@/lib/api/handler";
import { createDocumentType, documentTypeSchema, listDocumentTypes } from "@/app/admin/settings/lib";

export const GET = apiHandler({ permission: "settings.view" }, async () => listDocumentTypes());

export const POST = apiHandler({ permission: "settings.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, documentTypeSchema);
  return createDocumentType(body, { user: user!, ip, userAgent });
});
