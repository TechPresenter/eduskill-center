import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { getSectionForEdit, resetSectionAdmin, saveSectionAdmin } from "@/server/cms-admin";

export const GET = apiHandler<{ key: string }>({ permission: "cms.view" }, async ({ params }) => {
  const { def, data, customised, updatedAt } = await getSectionForEdit(params.key);
  return { key: def.key, name: def.name, page: def.page, fields: def.fields, defaults: def.defaults, data, customised, updatedAt };
});

export const PUT = apiHandler<{ key: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw Errors.badRequest("Invalid request body");
  }
  return saveSectionAdmin(params.key, raw, { user: user!, ip, userAgent });
});

/** Resets the section to the built-in defaults. */
export const DELETE = apiHandler<{ key: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => resetSectionAdmin(params.key, { user: user!, ip, userAgent }));
