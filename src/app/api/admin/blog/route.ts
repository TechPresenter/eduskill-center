import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { blogListSchema, blogSchema, createBlog, listBlogs } from "@/server/blog";

// Publishing and scheduling are gated inside `createBlog`/`updateBlog` (`assertCanPublish` →
// 403 without `cms.publish`), so the write routes here only ask for `cms.update`. Re-checking
// it at the route would lock an editor out of saving a draft they are allowed to write.

export const GET = apiHandler({ permission: "cms.view" }, async ({ req }) => listBlogs(parseQuery(req, blogListSchema)));

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, blogSchema);
  return createBlog(body, { user: user!, ip, userAgent });
});
