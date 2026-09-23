import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalUuid } from "@/lib/api/query";
import { blogTagUpdateSchema, deleteBlogTag, mergeBlogTag, renameBlogTag } from "@/server/blog";

// One body for both operations so the tag manager can submit a single form: supplying
// `mergeIntoId` folds this tag into another one, everything else is an edit in place. The
// field limits come from `blogTagUpdateSchema` rather than being restated here, so they cannot
// drift from what `renameBlogTag` accepts.
const tagBodySchema = blogTagUpdateSchema.extend({ mergeIntoId: optionalUuid });

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const { mergeIntoId, ...input } = await parseBody(req, tagBodySchema);
  const ctx = { user: user!, ip, userAgent };
  // Merge returns the TARGET tag, so the client can navigate to whatever survived.
  if (mergeIntoId) return mergeBlogTag(params.id, { intoId: mergeIntoId }, ctx);
  return renameBlogTag(params.id, input, ctx);
});

// Both mutations rewrite `Blog.tags` on every affected post; the service refuses with 409 above
// its rewrite cap rather than holding a write lock over thousands of rows.
export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlogTag(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
