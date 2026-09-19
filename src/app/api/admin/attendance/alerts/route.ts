import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { sendAttendanceAlerts } from "@/server/progress";

const schema = z.object({ batchId: z.string().uuid() });

/** Sends low-attendance alerts to every active student of the batch below the course's minimum attendance. */
export const POST = apiHandler({ permission: ["attendance.mark", "notifications.send"] }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const sent = await sendAttendanceAlerts(body.batchId);
  await audit({ user: user!, action: "attendance_alerts", module: "attendance", recordType: "Batch", recordId: body.batchId, description: `${user!.name} sent low-attendance alerts to ${sent} student(s)`, newValue: { sent }, ip, userAgent });
  return { sent };
});
