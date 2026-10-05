import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseFaqInputSchema, deleteCourseFaq, updateCourseFaq } from "@/server/course-cms";

export const PUT = apiHandler<{ id: string; faqId: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseFaqInputSchema);
  return updateCourseFaq(params.faqId, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string; faqId: string }>({ permission: "courses.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteCourseFaq(params.faqId, { user: user!, ip, userAgent });
  return { deleted: true };
});
