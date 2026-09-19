import { apiHandler, parseBody } from "@/lib/api/handler";
import { createStory, listStories, storySchema } from "@/server/cms-admin";

export const GET = apiHandler({ permission: "cms.view" }, async () => listStories());

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, storySchema);
  return createStory(body, { user: user!, ip, userAgent });
});
