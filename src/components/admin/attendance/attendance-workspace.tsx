"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { dateInputValue } from "@/lib/utils";
import { Tabs } from "@/components/ui/tabs";
import { MarkSheet } from "@/components/admin/attendance/mark-sheet";
import { BatchReport, type Preset } from "@/components/admin/attendance/batch-report";
import { StudentLookup } from "@/components/admin/attendance/student-lookup";
import type { BatchLite, CenterLite, CourseLite } from "@/components/admin/attendance/batch-selector";

export interface AttendanceWorkspaceProps {
  centers: CenterLite[];
  batches: BatchLite[];
  courses: CourseLite[];
  can: { mark: boolean; export: boolean; alerts: boolean };
  initial: { tab?: string; centerId?: string; batchId?: string; date?: string; preset?: string; from?: string; to?: string; studentId?: string };
}

type Tab = "sheet" | "reports" | "student";

/** Attendance module: daily sheet, batch reports and per-student lookup. Selection is mirrored into the URL for deep links. */
export function AttendanceWorkspace({ centers, batches, courses, can, initial }: AttendanceWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState<Tab>(initial.tab === "reports" || initial.tab === "student" ? initial.tab : "sheet");
  const [sel, setSel] = React.useState({
    centerId: initial.centerId ?? "",
    batchId: initial.batchId ?? "",
    date: initial.date ?? dateInputValue(new Date()),
    preset: (["daily", "weekly", "monthly", "custom"].includes(initial.preset ?? "") ? initial.preset : "weekly") as Preset,
    from: initial.from ?? "",
    to: initial.to ?? "",
    studentId: initial.studentId ?? "",
  });

  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (tab !== "sheet") sp.set("tab", tab);
    if (tab !== "student") {
      if (sel.centerId) sp.set("centerId", sel.centerId);
      if (sel.batchId) sp.set("batchId", sel.batchId);
    }
    if (tab === "sheet" && sel.date) sp.set("date", sel.date);
    if (tab === "reports") {
      sp.set("preset", sel.preset);
      if (sel.preset === "custom") {
        if (sel.from) sp.set("from", sel.from);
        if (sel.to) sp.set("to", sel.to);
      }
    }
    if (tab === "student" && sel.studentId) sp.set("studentId", sel.studentId);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, sel, pathname, router]);

  return (
    <div>
      <Tabs
        className="-mx-4 mb-5 max-w-[100vw] px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:max-w-none lg:px-0"
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { value: "sheet", label: "Mark attendance" },
          { value: "reports", label: "Reports" },
          { value: "student", label: "Student lookup" },
        ]}
      />
      <div role="tabpanel">
        {tab === "sheet" && <MarkSheet centers={centers} batches={batches} courses={courses} canMark={can.mark} centerId={sel.centerId} batchId={sel.batchId} date={sel.date} onSelection={(v) => setSel((s) => ({ ...s, ...v }))} />}
        {tab === "reports" && <BatchReport centers={centers} batches={batches} courses={courses} can={can} centerId={sel.centerId} batchId={sel.batchId} preset={sel.preset} from={sel.from} to={sel.to} onSelection={(v) => setSel((s) => ({ ...s, ...v }))} />}
        {tab === "student" && <StudentLookup canExport={can.export} studentId={sel.studentId} onSelect={(studentId) => setSel((s) => ({ ...s, studentId }))} />}
      </div>
    </div>
  );
}
