import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogAuthorSchema, createBlogAuthor, listBlogAuthors } from "@/server/blog";

export const GET = apiHandler({ permission: "cms.view" }, async () => listBlogAuthors());

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, blogAuthorSchema);
  return createBlogAuthor(body, { user: user!, ip, userAgent });
});
