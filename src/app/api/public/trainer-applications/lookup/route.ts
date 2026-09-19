import { apiHandler, parseBody } from "@/lib/api/handler";
import { trainerStatusLookupSchema } from "@/lib/validation/trainers";
import { lookupTrainerApplication } from "@/server/trainers";
import { createUploadToken } from "@/server/trainer-upload-token";

/** Statuses in which the applicant may still add documents. */
export const UPLOADABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "SHORTLISTED", "INTERVIEW"] as const;

/**
 * POST /api/public/trainer-applications/lookup  { applicationNo, mobile }
 * Public status tracking. Includes a fresh upload token while documents can still be added.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 10 * 60, name: "trainer-lookup" } }, async ({ req }) => {
  const body = await parseBody(req, trainerStatusLookupSchema);
  const app = await lookupTrainerApplication(body.applicationNo, body.mobile);
  const canUpload = (UPLOADABLE_STATUSES as readonly string[]).includes(app.status);
  return { ...app, canUpload, uploadToken: canUpload ? createUploadToken(app.id) : null };
});
