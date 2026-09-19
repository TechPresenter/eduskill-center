import { apiHandler, parseBody } from "@/lib/api/handler";
import { batchAnnouncementSchema, createBatchAnnouncement } from "@/server/coursework";
import { assertActiveTrainer, trainerOf, visibleAnnouncements } from "@/server/trainer-scope";

/** GET /api/trainer/announcements → announcements addressed to me (ALL / TRAINERS / my centers / my batches). */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ user }) => {
  const t = trainerOf(user);
  return visibleAnnouncements(t.id);
});

/** POST /api/trainer/announcements { batchId, title, body } → BATCH announcement + in-app notification to admitted students. */
export const POST = apiHandler({ roles: ["TRAINER"], rateLimit: { limit: 30, windowSec: 3600, keyBy: "user", name: "trainer-announce" } }, async ({ req, user, ip, userAgent }) => {
  assertActiveTrainer(user);
  const body = await parseBody(req, batchAnnouncementSchema);
  return createBatchAnnouncement(body, user!, { ip, userAgent });
});
