import { db } from "@/lib/db";

/** Select options for the report filter bar. Batches narrow to the chosen center/course when given. */
export async function reportFilterOptions(filters: readonly string[], current: { centerId?: string; courseId?: string; stateId?: string }) {
  const [centers, courses, batches, states] = await Promise.all([
    filters.includes("center") ? db.center.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }) : Promise.resolve([]),
    filters.includes("course") ? db.course.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true } }) : Promise.resolve([]),
    filters.includes("batch")
      ? db.batch.findMany({ where: { deletedAt: null, centerId: current.centerId, courseId: current.courseId }, orderBy: { startDate: "desc" }, take: 200, select: { id: true, code: true, name: true, status: true } })
      : Promise.resolve([]),
    filters.includes("state") || filters.includes("district") ? db.state.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true } }) : Promise.resolve([]),
  ]);
  return { centers, courses, batches, states };
}

export const REPORT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  trainers: [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ],
  centers: [
    { value: "ACTIVE", label: "Active" },
    { value: "PENDING", label: "Pending" },
    { value: "INACTIVE", label: "Inactive" },
  ],
  courses: [
    { value: "ACTIVE", label: "Active" },
    { value: "DRAFT", label: "Draft" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "ARCHIVED", label: "Archived" },
  ],
  batches: [
    { value: "UPCOMING", label: "Upcoming" },
    { value: "ONGOING", label: "Ongoing" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  admissions: [
    { value: "ACTIVE", label: "Active" },
    { value: "ON_HOLD", label: "On hold" },
    { value: "COMPLETED", label: "Completed" },
    { value: "DROPPED", label: "Dropped" },
  ],
  payments: [
    { value: "PENDING", label: "Pending" },
    { value: "PROCESSING", label: "Processing" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "REFUNDED", label: "Refunded" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  scholarships: [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ],
  certificates: [
    { value: "ISSUED", label: "Issued" },
    { value: "REVOKED", label: "Revoked" },
  ],
};
