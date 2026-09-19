import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseInputSchema, deleteCourse, getCourseAdmin, updateCourse } from "@/server/courses";

export const GET = apiHandler<{ id: string }>({ permission: "courses.view" }, async ({ params }) => getCourseAdmin(params.id));

export const PUT = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseInputSchema);
  return updateCourse(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "courses.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteCourse(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
