import { apiHandler } from "@/lib/api/handler";
import { getTicket } from "@/server/support";

export const GET = apiHandler<{ id: string }>({ permission: "support.view" }, async ({ params }) => getTicket(params.id));
