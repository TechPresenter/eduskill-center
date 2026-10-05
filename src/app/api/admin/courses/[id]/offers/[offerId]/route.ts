import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseOfferInputSchema, deleteCourseOffer, updateCourseOffer } from "@/server/course-cms";

export const PUT = apiHandler<{ id: string; offerId: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseOfferInputSchema);
  return updateCourseOffer(params.offerId, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string; offerId: string }>({ permission: "courses.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteCourseOffer(params.offerId, { user: user!, ip, userAgent });
  return { deleted: true };
});
