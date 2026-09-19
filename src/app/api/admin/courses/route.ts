import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { courseInputSchema, courseListSchema, createCourse, listCoursesAdmin } from "@/server/courses";

export const GET = apiHandler({ permission: "courses.view" }, async ({ req }) => listCoursesAdmin(parseQuery(req, courseListSchema)));

export const POST = apiHandler({ permission: "courses.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, courseInputSchema);
  return createCourse(body, { user: user!, ip, userAgent });
});
