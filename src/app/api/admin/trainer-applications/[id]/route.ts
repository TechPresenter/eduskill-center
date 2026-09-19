import { apiHandler } from "@/lib/api/handler";
import { getTrainerApplicationDetail } from "@/server/trainers";

export const GET = apiHandler<{ id: string }>({ permission: "trainers.view" }, async ({ params }) => getTrainerApplicationDetail(params.id));
