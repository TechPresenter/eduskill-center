import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { approveTrainerApplication } from "@/server/trainers";

const schema = z.object({ note: z.string().trim().max(2000).optional().nullable() });

/** Approves a VERIFIED application: creates the trainer account, Trainer ID and trainer record. */
export const POST = apiHandler<{ id: string }>({ permission: "trainers.approve" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const trainer = await approveTrainerApplication(params.id, { user: user!, ip, userAgent }, { note: body.note ?? null });
  return { id: trainer.id, trainerId: trainer.trainerId, userId: trainer.userId };
});
