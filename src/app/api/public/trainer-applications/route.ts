import { apiHandler, parseBody } from "@/lib/api/handler";
import { trainerApplicationSchema } from "@/lib/validation/trainers";
import { submitTrainerApplication } from "@/server/trainers";
import { createUploadToken } from "@/server/trainer-upload-token";

/**
 * POST /api/public/trainer-applications
 * Submits a volunteer trainer application. Returns { id, applicationNo, uploadToken } –
 * the token lets the applicant upload documents/photo for 2 hours without a login.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 5, windowSec: 60 * 60, name: "trainer-apply" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, trainerApplicationSchema);
  const { id, applicationNo } = await submitTrainerApplication(body, { ip, userAgent });
  return { id, applicationNo, uploadToken: createUploadToken(id) };
});
