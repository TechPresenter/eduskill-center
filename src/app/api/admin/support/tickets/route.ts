import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listTicketsAdmin, ticketListSchema } from "@/server/support";

export const GET = apiHandler({ permission: "support.view" }, async ({ req }) => listTicketsAdmin(parseQuery(req, ticketListSchema)));
