import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { moveToReview } from "@/server/applications";

const schema = z.object({ note: optionalString });

export const POST = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await moveToReview(params.id, { user: user!, ip, userAgent }, body.note ?? undefined);
  return { status: "UNDER_REVIEW" };
});
