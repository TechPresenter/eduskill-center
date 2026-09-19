import { apiHandler } from "@/lib/api/handler";
import { cmsPickerOptions } from "@/server/cms-admin";

/** Courses + centers for CMS pickers (success stories, gallery). */
export const GET = apiHandler({ permission: "cms.view" }, async () => cmsPickerOptions());
