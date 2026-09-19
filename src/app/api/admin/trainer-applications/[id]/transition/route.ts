import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { hasPermission } from "@/lib/rbac/permissions";
import { trainerTransitionSchema } from "@/lib/validation/trainers";
import { getTrainerApplicationDetail, transitionTrainerApplication } from "@/server/trainers";

/** Moves an application along the review workflow. Rejecting needs trainers.reject; everything else trainers.update. */
export const POST = apiHandler<{ id: string }>({ permission: ["trainers.update", "trainers.reject"] }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, trainerTransitionSchema);
  const needed = body.to === "REJECTED" ? "trainers.reject" : "trainers.update";
  if (!hasPermission(user, needed)) throw Errors.forbidden(`This action requires the "${needed}" permission.`);
  await transitionTrainerApplication(
    params.id,
    { to: body.to, note: body.note ?? null, interviewAt: body.interviewAt ? new Date(body.interviewAt) : null, interviewMode: body.interviewMode ?? null },
    { user: user!, ip, userAgent }
  );
  const detail = await getTrainerApplicationDetail(params.id);
  return { status: detail.status, allowedTransitions: detail.allowedTransitions };
});
