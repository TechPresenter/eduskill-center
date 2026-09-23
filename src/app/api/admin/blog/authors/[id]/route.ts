import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogAuthorUpdateSchema, deleteBlogAuthor, updateBlogAuthor } from "@/server/blog";

// A dedicated update schema rather than `.partial()` — see the note on the schema: a plain partial
// still applies the `.default()` on an absent `isActive`/`sortOrder`, so saving one field was
// reactivating a switched-off author and resetting their order.
export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, blogAuthorUpdateSchema);
  return updateBlogAuthor(params.id, body, { user: user!, ip, userAgent });
});

// 409 while the author is still credited on a post: SetNull would otherwise strip the byline
// off published articles without a word.
export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlogAuthor(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
