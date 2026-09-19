import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { cancelApplication } from "@/server/applications";

const schema = z.object({ reason: z.string().trim().min(3, "Enter a reason").max(2000) });

export const POST = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await cancelApplication(params.id, body.reason, { user: user!, ip, userAgent });
  return { status: "CANCELLED" };
});
