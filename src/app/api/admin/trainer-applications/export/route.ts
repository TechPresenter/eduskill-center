import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listTrainerApplications, trainerApplicationListSchema } from "@/server/trainers";
import { audit } from "@/lib/audit";
import { csvFromRecords } from "@/lib/csv";
import { titleCase } from "@/lib/utils";

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
        volunteerTermsAcceptedAt: a.volunteerTermsAcceptedAt?.toISOString() ?? "",
        inChargeTermsAcceptedAt: a.inChargeTermsAcceptedAt?.toISOString() ?? "",
        submittedAt: a.submittedAt.toISOString(),
      });
    }
    if (page >= res.meta.totalPages) break;
  }
  const csv = csvFromRecords(rows, ["applicationNo"]);
  await audit({ user: user!, action: "export", module: "trainers", recordType: "TrainerApplication", description: `${user!.name} exported ${rows.length} trainer applications to CSV`, newValue: q, ip, userAgent });
  // UTF-8 BOM: without it Excel on Windows reads the file in the ANSI code page and garbles
  // Devanagari names, places and the rupee sign.
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trainer-applications-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
