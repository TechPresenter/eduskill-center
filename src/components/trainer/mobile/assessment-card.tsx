"use client";

import * as React from "react";
import { ClipboardList, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatDate, titleCase } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ProgressBar } from "@/components/ui/stats";

/** One row of GET /api/trainer/assessments?batchId= (shared by the phone cards and the desktop table). */
export interface AssessmentRow {
  id: string;
  batchId: string;
  title: string;
  type: string;
  date: string | null;
  maxMarks: number;
  passingMarks: number;
  weightage: number;
  createdAt: string;
  resultCount: number;
}

export interface AssessmentCardProps {
  assessment: AssessmentRow;
  /** Active students in the batch (denominator of the results progress). */
  students?: number;
  canEdit: boolean;
  onEnterResults: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Phone card for an assessment (`lg:hidden`; the desktop table takes over from `lg`): title + type badge,
 * meta line, results progress or a Pending badge, then a full-width navy "Enter results" button and a 44px
 * overflow menu (Edit / Delete, delete disabled once results exist).
 */
export function AssessmentCard({ assessment: a, students, canEdit, onEnterResults, onEdit, onDelete }: AssessmentCardProps) {
  const total = students ?? 0;
  const hasResults = a.resultCount > 0;
  return (
    <article className="card p-4 lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-base font-bold text-navy">{a.title}</h3>
        <Badge tone="navy" className="shrink-0">
          {titleCase(a.type)}
        </Badge>
      </div>
      <p className="mt-1 text-meta text-muted">
        {a.date ? formatDate(a.date) : "Date TBA"} · {a.maxMarks} marks (pass {a.passingMarks}) · weight {a.weightage}
      </p>
      <div className="mt-3">
        {hasResults ? (
          <ProgressBar value={a.resultCount} max={Math.max(total, a.resultCount)} tone="navy" label={`${a.resultCount}${total ? ` / ${total}` : ""} results`} />
        ) : (
          <Badge tone="warning">Pending</Badge>
        )}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_44px] items-center gap-2">
        <Button variant="navy" size="md" fullWidth onClick={onEnterResults} leftIcon={<ClipboardList className="h-4 w-4" />}>
          {canEdit ? "Enter results" : "View results"}
        </Button>
        <Dropdown
          mobileTitle={a.title}
          trigger={<IconButton size="md" variant="outline" aria-label={`More actions for ${a.title}`} icon={<MoreVertical className="h-5 w-5" />} className="h-11 w-11" />}
        >
          <DropdownItem onClick={onEdit} disabled={!canEdit} icon={<Pencil className="h-4 w-4" />}>
            Edit
          </DropdownItem>
          <DropdownItem onClick={onDelete} disabled={!canEdit || hasResults} danger icon={<Trash2 className="h-4 w-4" />} description={hasResults ? "Results have been entered" : undefined}>
            Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </article>
  );
}
