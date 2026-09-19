import { apiHandler } from "@/lib/api/handler";
import { getAdmissionDetail } from "@/server/admissions";

export const GET = apiHandler<{ id: string }>({ permission: "admissions.view" }, async ({ params }) => getAdmissionDetail(params.id));
