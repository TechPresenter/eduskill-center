import { apiHandler, parseQuery } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { donationListSchema, exportDonationsCsv } from "@/server/donations-admin";

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = apiHandler({ permission: "donations.view" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, donationListSchema);
  const rows = await exportDonationsCsv(q);
  const headers = rows[0] ? Object.keys(rows[0]) : ["donationNo"];
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell((r as Record<string, unknown>)[h])).join(","))].join("\r\n");
  await audit({ user: user!, action: "export", module: "donations", recordType: "Donation", description: `${user!.name} exported ${rows.length} donations to CSV`, newValue: q, ip, userAgent });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
