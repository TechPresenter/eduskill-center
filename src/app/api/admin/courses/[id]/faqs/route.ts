import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseFaqInputSchema, createCourseFaq, listCourseFaqs } from "@/server/course-cms";

export const GET = apiHandler<{ id: string }>({ permission: "courses.view" }, async ({ params }) => listCourseFaqs(params.id));

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseFaqInputSchema);
  return createCourseFaq(params.id, body, { user: user!, ip, userAgent });
});
