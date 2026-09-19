import { apiHandler, parseBody } from "@/lib/api/handler";
import { centreApplicationLookupSchema } from "@/lib/validation/centre-applications";
import { lookupCentreApplication } from "@/server/centre-applications";
import { createUploadToken } from "@/server/trainer-upload-token";
import { CENTRE_UPLOAD_CLOSED_STATUSES } from "@/app/(site)/open-a-centre/centre-documents";

/**
 * POST /api/public/centre-applications/lookup  { applicationNo, mobile }
 * Public tracking for the seven-step centre process. Includes a fresh upload token while the
 * applicant may still add documents.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 10 * 60, name: "centre-lookup" } }, async ({ req }) => {
  const body = await parseBody(req, centreApplicationLookupSchema);
  const app = await lookupCentreApplication(body.applicationNo, body.mobile);
  const canUpload = !CENTRE_UPLOAD_CLOSED_STATUSES.includes(app.status);
  return { ...app, canUpload, uploadToken: canUpload ? createUploadToken(app.id) : null };
});
