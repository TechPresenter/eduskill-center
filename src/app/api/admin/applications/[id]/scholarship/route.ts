import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { decideScholarship } from "@/server/scholarships";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  programId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  scholarshipAmount: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(10_000_000).optional()),
  percentage: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(100).optional()),
  remarks: optionalString,
});

/** Records the scholarship decision for an application and recalculates the payable fee. */
export const POST = apiHandler<{ id: string }>({ permission: "scholarships.approve" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return decideScholarship(
    params.id,
    { status: body.status, programId: body.programId ?? null, scholarshipAmount: body.scholarshipAmount, percentage: body.percentage, remarks: body.remarks ?? null },
    { user: user!, ip, userAgent }
  );
});
