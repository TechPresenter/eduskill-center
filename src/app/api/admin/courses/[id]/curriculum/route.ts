import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseNodeInputSchema, createCourseNode, getCourseCurriculum } from "@/server/course-cms";

export const GET = apiHandler<{ id: string }>({ permission: "courses.view" }, async ({ params }) => getCourseCurriculum(params.id));

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseNodeInputSchema);
  return createCourseNode(params.id, body, { user: user!, ip, userAgent });
});
