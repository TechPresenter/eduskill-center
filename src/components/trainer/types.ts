/** Client-safe shapes shared by trainer-portal client components (serialised from server data). */

export interface BatchOption {
  id: string;
  code: string;
  name: string;
  status: "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
  courseName: string;
  centerName: string;
  startDate: string;
  endDate: string;
  days: string[];
  startTime: string;
  endTime: string;
  room: string | null;
  students: number;
}

export function batchLabel(b: BatchOption) {
  return `${b.name} · ${b.code}`;
}
