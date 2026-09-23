import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogCategorySchema, deleteBlogCategory, updateBlogCategory } from "@/server/blog";

// `.partial()` so the manager can PATCH-style save a single field (a tone, a sort order)
// without having to echo back the whole category.
export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, blogCategorySchema.partial());
  return updateBlogCategory(params.id, body, { user: user!, ip, userAgent });
});

// The service refuses with 409 while any post still points here — the FK is SetNull, so an
// unguarded delete would silently strip the category off every one of them.
export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlogCategory(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
