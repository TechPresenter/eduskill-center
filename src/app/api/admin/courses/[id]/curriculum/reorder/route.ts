import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { reorderCourseNodes, reorderSchema } from "@/server/course-cms";
import { uuid } from "@/lib/validation/common";

/** One level of the tree at a time: the children of `parentId`, or the roots when it is null. */
const schema = reorderSchema.extend({ parentId: z.union([z.literal(""), uuid]).optional().nullable() });

export const POST = apiHandler<{ id: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await reorderCourseNodes(params.id, body.parentId || null, body.ids, { user: user!, ip, userAgent });
  return { ok: true };
});
