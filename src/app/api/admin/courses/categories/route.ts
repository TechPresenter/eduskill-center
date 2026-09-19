import { apiHandler, parseBody } from "@/lib/api/handler";
import { categoryInputSchema, createCategory, listCategories } from "@/server/courses";

export const GET = apiHandler({ permission: "courses.view" }, async () => listCategories());

export const POST = apiHandler({ permission: "courses.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, categoryInputSchema);
  return createCategory(body, { user: user!, ip, userAgent });
});
