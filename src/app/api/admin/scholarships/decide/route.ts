import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { decideScholarship } from "@/server/scholarships";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const schema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  programId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  scholarshipAmount: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(10_000_000).optional()),
  percentage: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(100).optional()),
  remarks: optionalString,
});

/** Quick scholarship decision from the Scholarships module (same rules as the application detail panel). */
export const POST = apiHandler({ permission: "scholarships.approve" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return decideScholarship(
    body.applicationId,
    { status: body.status, programId: body.programId ?? null, scholarshipAmount: body.scholarshipAmount, percentage: body.percentage, remarks: body.remarks ?? null },
    { user: user!, ip, userAgent }
  );
});
