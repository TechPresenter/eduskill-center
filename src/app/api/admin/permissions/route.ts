import { apiHandler } from "@/lib/api/handler";
import { permissionCatalog } from "@/server/roles";

export const GET = apiHandler({ permission: "roles.view" }, async () => permissionCatalog());
