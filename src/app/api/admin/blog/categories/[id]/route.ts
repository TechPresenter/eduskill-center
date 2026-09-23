import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogCategoryUpdateSchema, deleteBlogCategory, updateBlogCategory } from "@/server/blog";

// A dedicated update schema rather than `.partial()`: Zod keeps a `.default()` on an absent key,
// so the plain partial was writing `isActive: true` and `sortOrder: 0` over the stored values
// every time the manager saved a single field. See the note on the schema.
export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, blogCategoryUpdateSchema);
  return updateBlogCategory(params.id, body, { user: user!, ip, userAgent });
});

// The service refuses with 409 while any post still points here — the FK is SetNull, so an
// unguarded delete would silently strip the category off every one of them.
export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlogCategory(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
