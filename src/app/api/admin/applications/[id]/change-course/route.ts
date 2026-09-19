import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { changeCourseOrCenter } from "@/server/applications";

const schema = z
  .object({ centerId: z.string().uuid().optional(), courseId: z.string().uuid().optional() })
  .refine((v) => v.centerId || v.courseId, { message: "Choose a center or a course to change", path: ["courseId"] });

/** Change center and/or course before approval. Fees are recalculated and the batch is cleared. */
export const POST = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const updated = await changeCourseOrCenter(params.id, body, { user: user!, ip, userAgent });
  return { centerId: updated.centerId, courseId: updated.courseId };
});
