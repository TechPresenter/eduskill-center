import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createProgram, listPrograms, programListSchema, scholarshipProgramSchema } from "@/server/scholarship-programs";

export const GET = apiHandler({ permission: "scholarships.view" }, async ({ req }) => {
  const q = parseQuery(req, programListSchema);
  return listPrograms(q);
});

export const POST = apiHandler({ permission: "scholarships.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, scholarshipProgramSchema);
  return createProgram(body, { user: user!, ip, userAgent });
});
