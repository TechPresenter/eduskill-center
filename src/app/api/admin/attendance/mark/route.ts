import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { markAttendance } from "@/server/attendance";

const schema = z.object({
  batchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  records: z
    .array(z.object({ studentId: z.string().uuid(), status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]), remarks: optionalString }))
    .min(1, "Mark at least one student")
    .max(500),
});

/** Marks or edits attendance for a batch on a date (staff with attendance.mark). */
export const POST = apiHandler({ permission: "attendance.mark" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return markAttendance(body, user!, { ip, userAgent });
});
