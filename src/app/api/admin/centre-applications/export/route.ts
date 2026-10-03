import { apiHandler, parseQuery } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { csvFromRecords } from "@/lib/csv";
import { titleCase } from "@/lib/utils";
import { CENTRE_STEP_OF, centreApplicationListSchema, listCentreApplications } from "@/server/centre-applications";

/** CSV export of centre applications using the same filters as the list (max 5000 rows). */
export const GET = apiHandler({ permission: "centre_applications.export" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, centreApplicationListSchema);
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await listCentreApplications({ ...q, page, limit: 100 });
    for (const a of res.items) {
      rows.push({
        applicationNo: a.applicationNo,
        applicantName: a.applicantName,
        email: a.email,
        mobile: a.mobile,
        gender: titleCase(a.gender),
        qualification: a.qualification,
        occupation: a.occupation ?? "",
        teachingExperienceYears: a.teachingExperienceYears,
        proposedName: a.proposedName,
        villageTown: a.villageTown,
        block: a.block.name,
        district: a.district.name,
        state: a.state.name,
        pincode: a.pincode,
        spaceType: titleCase(a.spaceType),
        roomCount: a.roomCount,
        areaSqft: a.areaSqft ?? "",
        seatingCapacity: a.seatingCapacity,
        expectedStudents: a.expectedStudents,
        classes: a.classes.map((c) => titleCase(c)).join("; "),
        facilities: [a.hasElectricity ? "Electricity" : null, a.hasDrinkingWater ? "Drinking Water" : null, a.hasToilet ? "Toilet" : null, a.hasFurniture ? "Furniture" : null].filter(Boolean).join("; "),
        status: titleCase(a.status),
        step: `${CENTRE_STEP_OF[a.status]} of 7`,
        documents: a._count.documents,
        verificationAt: a.verificationAt?.toISOString() ?? "",
        orientationAt: a.orientationAt?.toISOString() ?? "",
        centerCode: a.center?.code ?? "",
        submittedAt: a.submittedAt.toISOString(),
      });
    }
    if (page >= res.meta.totalPages) break;
  }
  const csv = csvFromRecords(rows, ["applicationNo"]);
  await audit({
    user: user!,
    action: "export",
    module: "centre_applications",
    recordType: "CentreApplication",
    description: `${user!.name} exported ${rows.length} centre applications to CSV`,
    newValue: q,
    ip,
    userAgent,
  });
  // UTF-8 BOM: without it Excel on Windows reads the file in the ANSI code page and garbles
  // Devanagari names, places and the rupee sign.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="centre-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
