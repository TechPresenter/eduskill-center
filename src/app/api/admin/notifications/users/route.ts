import { apiHandler, parseQuery } from "@/lib/api/handler";
import { searchUsers, userSearchSchema } from "@/server/notifications-admin";

/** Search a recipient by name, email, mobile, Student ID or Trainer ID. */
export const GET = apiHandler({ permission: "notifications.send" }, async ({ req }) => {
  const q = parseQuery(req, userSearchSchema);
  return searchUsers(q.q);
});
