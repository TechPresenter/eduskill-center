import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { exportLocationsCsv } from "@/server/locations";

const schema = z.object({ stateId: z.string().uuid().optional() });

export const GET = apiHandler({ permission: "locations.export" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, schema);
  const csv = await exportLocationsCsv(q);
  await audit({ user: user!, action: "export", module: "locations", recordType: "Export", description: `${user!.name} exported the location hierarchy as CSV`, ip, userAgent });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="eduskill-locations-${stamp}.csv"`, "Cache-Control": "no-store" },
  });
});
