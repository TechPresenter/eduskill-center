import { apiHandler, parseBody } from "@/lib/api/handler";
import { impactStatSchema, updateImpactStat } from "@/app/admin/settings/lib";

export const PUT = apiHandler<{ id: string }>({ permission: "settings.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, impactStatSchema);
  return updateImpactStat(params.id, body, { user: user!, ip, userAgent });
});
