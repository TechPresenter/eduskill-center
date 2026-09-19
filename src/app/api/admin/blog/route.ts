import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { blogListSchema, blogSchema, createBlog, listBlogs } from "@/server/content";

export const GET = apiHandler({ permission: "cms.view" }, async ({ req }) => listBlogs(parseQuery(req, blogListSchema)));

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, blogSchema);
  return createBlog(body, { user: user!, ip, userAgent });
});
