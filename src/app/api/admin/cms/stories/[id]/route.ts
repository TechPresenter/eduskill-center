import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteStory, storySchema, updateStory } from "@/server/cms-admin";

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, storySchema);
  return updateStory(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteStory(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
