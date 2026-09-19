import { apiHandler, parseBody } from "@/lib/api/handler";
import { centreApproveSchema } from "@/lib/validation/centre-applications";
import { approveCentreApplication } from "@/server/centre-applications";

/** Step 7 – Centre Start: approves the application and creates the training centre. */
export const POST = apiHandler<{ id: string }>({ permission: "centre_applications.approve" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, centreApproveSchema);
  const center = await approveCentreApplication(
    params.id,
    { note: body.note ?? null, centerName: body.centerName, capacity: body.capacity, phone: body.phone ?? null, courseIds: body.courseIds ?? [] },
    { user: user!, ip, userAgent }
  );
  return { id: center.id, code: center.code, name: center.name, slug: center.slug, status: center.status };
});
