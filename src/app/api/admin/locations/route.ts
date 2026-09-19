import { apiHandler } from "@/lib/api/handler";
import { locationOverview } from "@/server/locations";

export const GET = apiHandler({ permission: "locations.view" }, async () => locationOverview());
