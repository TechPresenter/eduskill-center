import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogAuthorSchema, deleteBlogAuthor, updateBlogAuthor } from "@/server/blog";

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, blogAuthorSchema.partial());
  return updateBlogAuthor(params.id, body, { user: user!, ip, userAgent });
});

// 409 while the author is still credited on a post: SetNull would otherwise strip the byline
// off published articles without a word.
export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlogAuthor(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
