import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { approveApplication } from "@/server/applications";

const schema = z.object({
  batchId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid("Select a batch").nullable()),
  note: optionalString,
});

/** Approve after review. Result status: PAYMENT_PENDING (fee due), ADMISSION_CONFIRMED (no fee + batch) or APPROVED (no batch yet). */
export const POST = apiHandler<{ id: string }>({ permission: "applications.approve" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return approveApplication(params.id, { batchId: body.batchId, note: body.note ?? null }, { user: user!, ip, userAgent });
});
