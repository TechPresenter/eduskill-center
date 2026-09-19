import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { setCourseStatus } from "@/server/courses";

const schema = z.object({ status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]) });

export const PATCH = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return setCourseStatus(params.id, body.status, { user: user!, ip, userAgent });
});
