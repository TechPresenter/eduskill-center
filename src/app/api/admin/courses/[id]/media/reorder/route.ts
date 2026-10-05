import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { reorderCourseMedia, reorderSchema } from "@/server/course-cms";

/** Gallery and promotional images are two independent orders, so the kind is part of the scope. */
const schema = reorderSchema.extend({ kind: z.enum(["GALLERY", "PROMOTIONAL"]) });

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await reorderCourseMedia(params.id, body.kind, body.ids, { user: user!, ip, userAgent });
  return { ok: true };
});
