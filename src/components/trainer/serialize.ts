import type { MyBatch } from "@/server/trainer-scope";
import type { BatchOption } from "@/components/trainer/types";

/** Server helper: turns a scoped batch row into the plain shape client components accept. */
export function toBatchOption(b: MyBatch): BatchOption {
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    status: b.status,
    courseName: b.course.name,
    centerName: b.center.name,
    startDate: b.startDate.toISOString().slice(0, 10),
    endDate: b.endDate.toISOString().slice(0, 10),
    days: b.days,
    startTime: b.startTime,
    endTime: b.endTime,
    room: b.room,
    students: b._count.admissions,
  };
}
