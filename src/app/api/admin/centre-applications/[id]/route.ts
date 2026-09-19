import { apiHandler } from "@/lib/api/handler";
import { getCentreApplicationDetail } from "@/server/centre-applications";

export const GET = apiHandler<{ id: string }>({ permission: "centre_applications.view" }, async ({ params }) =>
  getCentreApplicationDetail(params.id)
);
