import { z } from "zod";
import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { courseMediaInputSchema, createCourseMedia, listCourseMedia } from "@/server/course-cms";

const listSchema = z.object({ kind: z.enum(["GALLERY", "PROMOTIONAL"]).optional() });

export const GET = apiHandler<{ id: string }>({ permission: "courses.view" }, async ({ req, params }) => {
  const q = parseQuery(req, listSchema);
  return listCourseMedia(params.id, { kind: q.kind });
});

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseMediaInputSchema);
  return createCourseMedia(params.id, body, { user: user!, ip, userAgent });
});
