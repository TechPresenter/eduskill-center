import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { assignAdmissionTrainer } from "@/server/admissions";

const schema = z.object({ trainerId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid("Select a trainer").nullable()) });

export const PUT = apiHandler<{ id: string }>({ permission: "admissions.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const updated = await assignAdmissionTrainer(params.id, body.trainerId, { user: user!, ip, userAgent });
  return { trainerId: updated.trainerId };
});
