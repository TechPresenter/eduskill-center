import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listTrainerApplications, trainerApplicationListSchema } from "@/server/trainers";
import { audit } from "@/lib/audit";
import { titleCase } from "@/lib/utils";

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of trainer applications using the same filters as the list (max 5000 rows). */
export const GET = apiHandler({ permission: "trainers.export" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, trainerApplicationListSchema);
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await listTrainerApplications({ ...q, page, limit: 100 });
    for (const a of res.items) {
      rows.push({
        applicationNo: a.applicationNo,
        name: a.name,
        email: a.email,
        mobile: a.mobile,
        gender: titleCase(a.gender),
        level: titleCase(a.level),
        state: a.state.name,
        district: a.district?.name ?? "",
        block: a.block?.name ?? "",
        qualification: a.qualification,
        skills: a.skills.join("; "),
        experienceYears: a.experienceYears,
        teachingExperienceYears: a.teachingExperienceYears,
        languages: a.languages.join("; "),
        trainingMode: titleCase(a.trainingMode),
        status: titleCase(a.status),
        documents: a._count.documents,
        interviewAt: a.interviewAt?.toISOString() ?? "",
        submittedAt: a.submittedAt.toISOString(),
      });
    }
    if (page >= res.meta.totalPages) break;
  }
  const headers = rows[0] ? Object.keys(rows[0]) : ["applicationNo"];
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n");
  await audit({ user: user!, action: "export", module: "trainers", recordType: "TrainerApplication", description: `${user!.name} exported ${rows.length} trainer applications to CSV`, newValue: q, ip, userAgent });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trainer-applications-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
