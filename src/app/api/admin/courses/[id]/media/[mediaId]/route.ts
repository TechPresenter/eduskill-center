import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseMediaInputSchema, deleteCourseMedia, updateCourseMedia } from "@/server/course-cms";

export const PUT = apiHandler<{ id: string; mediaId: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseMediaInputSchema);
  return updateCourseMedia(params.mediaId, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string; mediaId: string }>({ permission: "courses.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteCourseMedia(params.mediaId, { user: user!, ip, userAgent });
  return { deleted: true };
});
