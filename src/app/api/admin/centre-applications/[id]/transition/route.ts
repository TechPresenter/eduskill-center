import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { hasPermission } from "@/lib/rbac/permissions";
import { centreTransitionSchema } from "@/lib/validation/centre-applications";
import { getCentreApplicationDetail, transitionCentreApplication } from "@/server/centre-applications";

/**
 * Moves a centre application through steps 1–6 of the Shiksha Mission process.
 * Rejecting needs `centre_applications.reject`, marking documents verified needs
 * `centre_applications.verify`, everything else `centre_applications.update`.
 * Step 7 (APPROVED) has its own route because it creates the training centre.
 */
const handler = apiHandler<{ id: string }>(
  { permission: ["centre_applications.update", "centre_applications.verify", "centre_applications.reject"] },
  async ({ req, params, user, ip, userAgent }) => {
    const body = await parseBody(req, centreTransitionSchema);
    const needed = body.to === "REJECTED" ? "centre_applications.reject" : body.to === "DOCUMENTS_VERIFIED" ? "centre_applications.verify" : "centre_applications.update";
    if (!hasPermission(user, needed)) throw Errors.forbidden(`This action requires the "${needed}" permission.`);
    await transitionCentreApplication(
      params.id,
      {
        to: body.to,
        note: body.note ?? null,
        verificationAt: body.verificationAt ? new Date(body.verificationAt) : null,
        orientationAt: body.orientationAt ? new Date(body.orientationAt) : null,
        orientationMode: body.orientationMode ?? null,
        agreementReference: body.agreementReference ?? null,
      },
      { user: user!, ip, userAgent }
    );
    const detail = await getCentreApplicationDetail(params.id);
    return { status: detail.status, step: detail.step, allowedTransitions: detail.allowedTransitions };
  }
);

export const POST = handler;
export const PATCH = handler;
