import { apiHandler, parseBody } from "@/lib/api/handler";
import { courseNodeInputSchema, deleteCourseNode, updateCourseNode } from "@/server/course-cms";

export const PUT = apiHandler<{ id: string; nodeId: string }>({ permission: "courses.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, courseNodeInputSchema);
  return updateCourseNode(params.nodeId, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string; nodeId: string }>({ permission: "courses.update" }, async ({ params, user, ip, userAgent }) =>
  deleteCourseNode(params.nodeId, { user: user!, ip, userAgent })
);
