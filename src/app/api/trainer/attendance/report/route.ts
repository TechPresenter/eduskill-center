import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { uuid } from "@/lib/validation/common";
import { assertBatchAccess, batchAttendanceReport } from "@/server/attendance";
import { isoDay, myBatch, trainerOf, utcToday } from "@/server/trainer-scope";

const query = z.object({
  batchId: uuid,
  range: z.enum(["week", "month", "all"]).default("all"),
  format: z.enum(["json", "csv"]).default("json"),
});

function rangeFor(range: "week" | "month" | "all"): { from?: Date; to?: Date } {
  const today = utcToday();
  const to = new Date(today.getTime() + 86400000);
  if (range === "week") {
    const dow = today.getUTCDay();
    const monday = new Date(today.getTime() - ((dow + 6) % 7) * 86400000);
    return { from: monday, to };
  }
  if (range === "month") return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), to };
  return {};
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/trainer/attendance/report?batchId=&range=week|month|all&format=json|csv */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  const t = trainerOf(user);
  const q = parseQuery(req, query);
  await assertBatchAccess(user!, q.batchId, "attendance.view");
  const range = rangeFor(q.range);
  const [batch, report] = await Promise.all([myBatch(t.id, q.batchId), batchAttendanceReport(q.batchId, range)]);
  if (q.format === "csv") {
    const header = ["Student ID", "Name", "Classes held", "Present", "Late", "Absent", "Leave", "Attendance %"];
    const lines = [header.map(csvCell).join(",")];
    for (const r of report.rows) lines.push([r.studentCode ?? "", r.name, r.held, r.present, r.late, r.absent, r.leave, r.pct].map(csvCell).join(","));
    lines.push("");
    lines.push(["Date", "Present", "Late", "Absent", "Leave"].map(csvCell).join(","));
    for (const d of report.daily) lines.push([isoDay(d.date), d.present, d.late, d.absent, d.leave].map(csvCell).join(","));
    const filename = `attendance-${batch.code}-${q.range}-${isoDay(utcToday())}.csv`;
    return new Response("﻿" + lines.join("\r\n"), { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  }
  return { batch: { id: batch.id, code: batch.code, name: batch.name }, range: q.range, from: range.from ?? null, to: range.to ?? null, ...report };
});
