import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseOfferInputSchema, createCourseOffer, listCourseOffers } from "@/server/course-cms";

export const GET = apiHandler<{ id: string }>({ permission: "courses.view" }, async ({ params }) => listCourseOffers(params.id));

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseOfferInputSchema);
  return createCourseOffer(params.id, body, { user: user!, ip, userAgent });
});
