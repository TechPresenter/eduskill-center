"use client";

import * as React from "react";
import { formatDate, titleCase } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";

export interface CenterLite {
  id: string;
  name: string;
  code: string;
  status: string;
}
export interface BatchLite {
  id: string;
  name: string;
  code: string;
  status: string;
  centerId: string;
  courseId: string;
  startDate: string | Date;
  endDate: string | Date;
  capacity: number;
}
export interface CourseLite {
  id: string;
  name: string;
  code: string;
}

interface Props {
  centers: CenterLite[];
  batches: BatchLite[];
  courses: CourseLite[];
  centerId: string;
  batchId: string;
  onChange: (v: { centerId: string; batchId: string }) => void;
  /** Batch statuses offered (default: UPCOMING, ONGOING, COMPLETED). */
  statuses?: string[];
  idPrefix?: string;
}

/** Center → batch cascade used by the attendance sheet and reports. */
export function BatchSelector({ centers, batches, courses, centerId, batchId, onChange, statuses = ["UPCOMING", "ONGOING", "COMPLETED"], idPrefix = "bs" }: Props) {
  const courseName = React.useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses]);
  const list = batches.filter((b) => (!centerId || b.centerId === centerId) && statuses.includes(b.status));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Training center" htmlFor={`${idPrefix}-center`}>
        <Select id={`${idPrefix}-center`} value={centerId} onChange={(e) => onChange({ centerId: e.target.value, batchId: "" })} options={centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All centers" />
      </Field>
      <Field label="Batch" htmlFor={`${idPrefix}-batch`} hint={centerId && list.length === 0 ? "No batches at this center" : undefined}>
        <Select
          id={`${idPrefix}-batch`}
          value={batchId}
          onChange={(e) => {
            const b = batches.find((x) => x.id === e.target.value);
            onChange({ centerId: b?.centerId ?? centerId, batchId: e.target.value });
          }}
          options={list.map((b) => ({ value: b.id, label: `${b.code} · ${courseName.get(b.courseId) ?? b.name} · ${titleCase(b.status)} · ${formatDate(b.startDate, "dd MMM yy")}` }))}
          placeholder="Select a batch"
        />
      </Field>
    </div>
  );
}
