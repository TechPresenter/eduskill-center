import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { optionalUuid } from "@/lib/api/query";
import { getAdminLookups } from "@/server/admissions";

const schema = z.object({ centerId: optionalUuid, courseId: optionalUuid });

/** Selectable centers, courses, batches (optionally narrowed by center/course), active trainers and scholarship programs for admin pickers. */
export const GET = apiHandler(
  { permission: ["students.view", "applications.view", "admissions.view", "payments.view", "scholarships.view", "attendance.view", "progress.view", "certificates.view"] },
  async ({ req }) => {
    const q = parseQuery(req, schema);
    return getAdminLookups(q);
  }
);
