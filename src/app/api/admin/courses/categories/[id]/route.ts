import { apiHandler, parseBody } from "@/lib/api/handler";
import { categoryInputSchema, deleteCategory, updateCategory } from "@/server/courses";

export const PUT = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, categoryInputSchema.partial());
  return updateCategory(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "courses.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteCategory(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
