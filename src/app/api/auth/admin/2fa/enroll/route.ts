import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { getChallengeToken } from "@/lib/auth/challenge-cookie";
import { beginAdminEnrollment, confirmAdminEnrollment } from "@/server/admin-auth";
import { noStore, requestMeta, startSession } from "../../_lib/respond";

/**
 * First-time authenticator set-up during sign-in, when the Super Admin requires two-factor for every
 * administrator and this one has none yet.
 *
 * GET returns the QR code and the set-up key; POST confirms the first code, switches 2FA on, signs
 * the administrator in and returns the backup codes — the only time they are ever sent. Both answers
 * are `no-store`.
 */
export const GET = apiHandler({ auth: "none", rateLimit: { limit: 20, windowSec: 15 * 60, name: "admin-2fa-enroll-begin", failClosed: true } }, async () => {
  return noStore(await beginAdminEnrollment(await getChallengeToken()));
});

const schema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

export const POST = apiHandler({ auth: "none", rateLimit: { limit: 20, windowSec: 15 * 60, name: "admin-2fa-enroll-confirm", failClosed: true } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const r = await confirmAdminEnrollment(await getChallengeToken(), body.code, await requestMeta(ip, userAgent));
  if (r.step !== "done") return noStore({ step: r.step, state: r.state });
  await startSession(r.session);
  return noStore({ step: "done" as const, redirect: r.session.redirect, backupCodes: r.backupCodes ?? [] });
});
