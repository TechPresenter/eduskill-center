import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteDocumentType, documentTypeSchema, updateDocumentType } from "@/app/admin/settings/lib";

export const PUT = apiHandler<{ id: string }>({ permission: "settings.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, documentTypeSchema);
  return updateDocumentType(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "settings.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteDocumentType(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
