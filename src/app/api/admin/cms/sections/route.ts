import { apiHandler } from "@/lib/api/handler";
import { listSectionsWithState } from "@/server/cms-admin";

export const GET = apiHandler({ permission: "cms.view" }, async () => listSectionsWithState());
