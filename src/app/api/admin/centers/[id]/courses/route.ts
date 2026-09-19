import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { updateCenter } from "@/server/centers";

const schema = z.object({ courseIds: z.array(z.string().uuid()).max(200) });

/** Replaces the set of courses offered at the center. */
export const PUT = apiHandler<{ id: string }>({ permission: "centers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return updateCenter(params.id, { courseIds: body.courseIds }, { user: user!, ip, userAgent });
});
