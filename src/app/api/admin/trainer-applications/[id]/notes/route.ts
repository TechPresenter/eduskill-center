import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { addTrainerApplicationNote } from "@/server/trainers";

const schema = z.object({ note: z.string().trim().min(2, "Write a note").max(2000) });

export const POST = apiHandler<{ id: string }>({ permission: "trainers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await addTrainerApplicationNote(params.id, body.note, { user: user!, ip, userAgent });
  return { ok: true };
});
