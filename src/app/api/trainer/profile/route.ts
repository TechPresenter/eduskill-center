import { apiHandler, parseBody } from "@/lib/api/handler";
import { assertActiveTrainer, trainerOf, trainerProfile, trainerProfileSchema, updateTrainerProfile } from "@/server/trainer-scope";

export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ user }) => {
  const t = trainerOf(user);
  return trainerProfile(t.id);
});

export const PATCH = apiHandler({ roles: ["TRAINER"] }, async ({ req, user, ip, userAgent }) => {
  assertActiveTrainer(user);
  const body = await parseBody(req, trainerProfileSchema);
  return updateTrainerProfile(user!, body, { ip, userAgent });
});
