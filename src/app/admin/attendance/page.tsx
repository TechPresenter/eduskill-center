import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAdminLookups } from "@/server/admissions";
import { PageHeader } from "@/components/ui/misc";
import { AttendanceWorkspace } from "@/components/admin/attendance/attendance-workspace";
import { flattenSearchParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("attendance.view");
  const sp = flattenSearchParams(await searchParams);
  const lookups = await getAdminLookups();
  const can = {
    mark: hasPermission(user, "attendance.mark"),
    export: hasPermission(user, "attendance.export"),
    alerts: hasPermission(user, ["attendance.mark", "notifications.send"]),
  };
  return (
    <div>
      <PageHeader title="Attendance" description="Mark daily attendance for a batch, review batch reports and look up any student's record." />
      <AttendanceWorkspace
        centers={lookups.centers}
        batches={lookups.batches}
        courses={lookups.courses}
        can={can}
        initial={{ tab: sp.tab, centerId: sp.centerId, batchId: sp.batchId, date: sp.date, preset: sp.preset, from: sp.from, to: sp.to, studentId: sp.studentId }}
      />
    </div>
  );
}
