import { apiHandler } from "@/lib/api/handler";
import { trainerSessions } from "@/server/trainer-scope";

/** GET /api/trainer/sessions → my active sessions and recent login history. */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ user }) => trainerSessions(user!));
