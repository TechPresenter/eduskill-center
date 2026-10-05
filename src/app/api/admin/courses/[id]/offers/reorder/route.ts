import { apiHandler, parseBody } from "@/lib/api/handler";
import { reorderCourseOffers, reorderSchema } from "@/server/course-cms";

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, reorderSchema);
  await reorderCourseOffers(params.id, body.ids, { user: user!, ip, userAgent });
  return { ok: true };
});
