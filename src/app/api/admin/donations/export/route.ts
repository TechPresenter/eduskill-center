import { apiHandler, parseQuery } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { csvFromRecords } from "@/lib/csv";
import { donationListSchema, exportDonationsCsv } from "@/server/donations-admin";

export const GET = apiHandler({ permission: "donations.view" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, donationListSchema);
  const rows = await exportDonationsCsv(q);
  const csv = csvFromRecords(rows as Record<string, unknown>[], ["donationNo"]);
  await audit({ user: user!, action: "export", module: "donations", recordType: "Donation", description: `${user!.name} exported ${rows.length} donations to CSV`, newValue: q, ip, userAgent });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
