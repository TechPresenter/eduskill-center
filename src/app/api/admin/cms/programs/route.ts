import { apiHandler, parseBody } from "@/lib/api/handler";
import { createProgram, listPrograms, programSchema } from "@/server/cms-admin";

export const GET = apiHandler({ permission: "cms.view" }, async () => listPrograms());

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, programSchema);
  return createProgram(body, { user: user!, ip, userAgent });
});
