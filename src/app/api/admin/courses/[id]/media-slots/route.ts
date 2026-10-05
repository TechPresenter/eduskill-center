import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseMediaSlotsSchema, setCourseMediaSlots } from "@/server/courses";

/**
 * The four single-slot media fields on Course itself (banner, instructor photo, promo video and its
 * thumbnail). Separate from PUT /api/admin/courses/[id] so the Media tab does not have to round-trip
 * the whole course record just to swap one image.
 */
export const PUT = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseMediaSlotsSchema);
  return setCourseMediaSlots(params.id, body, { user: user!, ip, userAgent });
});
