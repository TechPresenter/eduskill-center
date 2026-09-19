import { apiHandler } from "@/lib/api/handler";
import { getApplicationDetail } from "@/server/applications";

export const GET = apiHandler<{ id: string }>({ permission: "applications.view" }, async ({ params }) => getApplicationDetail(params.id));
