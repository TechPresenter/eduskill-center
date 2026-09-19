import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteProgram, getProgram, scholarshipProgramSchema, setProgramActive, updateProgram } from "@/server/scholarship-programs";

export const GET = apiHandler<{ id: string }>({ permission: "scholarships.view" }, async ({ params }) => getProgram(params.id));

const activeSchema = z.object({ isActive: z.boolean() });

/** Full update (program form) or a quick active toggle when only `isActive` is sent. */
export const PATCH = apiHandler<{ id: string }>({ permission: "scholarships.update" }, async ({ req, params, user, ip, userAgent }) => {
  const raw = (await req.clone().json().catch(() => ({}))) as Record<string, unknown>;
  const ctx = { user: user!, ip, userAgent };
  if (Object.keys(raw).length === 1 && "isActive" in raw) {
    const body = await parseBody(req, activeSchema);
    return setProgramActive(params.id, body.isActive, ctx);
  }
  const body = await parseBody(req, scholarshipProgramSchema);
  return updateProgram(params.id, body, ctx);
});

export const DELETE = apiHandler<{ id: string }>({ permission: "scholarships.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteProgram(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
