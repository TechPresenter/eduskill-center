import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseFeePlanInputSchema, deleteCourseFeePlan, upsertCourseFeePlan } from "@/server/course-cms";

/** One plan per course, so create and edit are the same call. */
export const PUT = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseFeePlanInputSchema);
  return upsertCourseFeePlan(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteCourseFeePlan(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
