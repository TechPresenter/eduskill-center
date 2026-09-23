import { apiHandler, parseBody } from "@/lib/api/handler";
import { blogSchema, deleteBlog, getBlog, updateBlog } from "@/server/blog";

export const GET = apiHandler<{ id: string }>({ permission: "cms.view" }, async ({ params }) => getBlog(params.id));

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, blogSchema);
  return updateBlog(params.id, body, { user: user!, ip, userAgent });
});

// Delete stays on `cms.update`, the permission it has always used: every staff role that can
// manage the blog today keeps working without a re-grant.
export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlog(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
