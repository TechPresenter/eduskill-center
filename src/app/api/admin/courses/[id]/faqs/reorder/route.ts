import { apiHandler, parseBody } from "@/lib/api/handler";
import { reorderCourseFaqs, reorderSchema } from "@/server/course-cms";

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, reorderSchema);
  await reorderCourseFaqs(params.id, body.ids, { user: user!, ip, userAgent });
  return { ok: true };
});
