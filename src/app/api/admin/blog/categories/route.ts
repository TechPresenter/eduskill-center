import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogCategorySchema, createBlogCategory, listBlogCategories } from "@/server/blog";

// A static child segment beside the `[id]` sibling, exactly like /api/admin/courses/categories:
// Next resolves `categories` before it ever considers the dynamic route.

export const GET = apiHandler({ permission: "cms.view" }, async () => listBlogCategories());

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, blogCategorySchema);
  return createBlogCategory(body, { user: user!, ip, userAgent });
});
