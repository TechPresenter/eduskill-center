import { apiHandler, parseBody } from "@/lib/api/handler";
import { centreApplicationSchema } from "@/lib/validation/centre-applications";
import { submitCentreApplication } from "@/server/centre-applications";
import { createUploadToken } from "@/server/trainer-upload-token";

/**
 * POST /api/public/centre-applications
 * Public application to open a Normal Education Centre (Class 1–4). Returns
 * `{ id, applicationNo, uploadToken }` – the token lets the applicant upload their documents
 * and photo for the next two hours without a login.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 5, windowSec: 60 * 60, name: "centre-apply" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, centreApplicationSchema);
  const { id, applicationNo } = await submitCentreApplication(body, { ip, userAgent });
  return { id, applicationNo, uploadToken: createUploadToken(id) };
});
