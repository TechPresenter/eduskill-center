"use client";

import { CalendarClock, MoreVertical, Paperclip, Pencil, Trash2, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ProgressBar } from "@/components/ui/stats";

/** One row of GET /api/trainer/assignments?batchId= . */
export interface CourseworkRow {
  id: string;
  batchId: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  dueDate: string | null;
  maxMarks: number;
  createdAt: string;
  submissionCount: number;
  gradedCount: number;
}

export interface AssignmentCardProps {
  assignment: CourseworkRow;
  /** Today as `yyyy-mm-dd` (server-rendered), so "past due" does not depend on the device clock. */
  today: string;
  canEdit: boolean;
  onOpenSubmissions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One assignment, as a card: title, a "to grade" pill when work is waiting, the instructions preview,
 * the meta line, a grading-progress bar and the single primary action — open the submissions — with
 * Edit / Delete behind a 44px overflow menu (a sheet on phones).
 *
 * Deliberately one card for every width: the desktop list used to be the same information in a wider
 * row, which is exactly the duplication the audit flagged.
 */
export function AssignmentCard({ assignment: a, today, canEdit, onOpenSubmissions, onEdit, onDelete }: AssignmentCardProps) {
  const overdue = !!a.dueDate && a.dueDate.slice(0, 10) < today;
  const pending = a.submissionCount - a.gradedCount;

  return (
    <article className="card card-p">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-h4 text-navy">{a.title}</h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {pending > 0 && <Badge tone="orange">{pending} to grade</Badge>}
          {overdue && <Badge tone="neutral">Past due</Badge>}
        </div>
      </div>

      {a.description && <p className="mt-1.5 line-clamp-2 text-body-sm whitespace-pre-line text-muted">{a.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /> {a.dueDate ? `Due ${formatDateTime(a.dueDate)}` : "No due date"}
        </span>
        <span className="tabular-nums">{a.maxMarks} marks</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden /> {a.submissionCount} submitted
        </span>
        {a.attachmentUrl && (
          <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-navy hover:underline">
            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden /> Attachment
          </a>
        )}
      </div>

      {a.submissionCount > 0 && (
        <div className="mt-3">
          <ProgressBar value={a.gradedCount} max={a.submissionCount} tone={pending > 0 ? "orange" : "success"} label={`${a.gradedCount} of ${a.submissionCount} graded`} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-[1fr_44px] items-center gap-2">
        <Button variant="navy" size="md" fullWidth onClick={onOpenSubmissions}>
          Submissions{a.submissionCount ? ` (${a.submissionCount})` : ""}
        </Button>
        <Dropdown mobileTitle={a.title} trigger={<IconButton size="md" variant="outline" aria-label={`More actions for ${a.title}`} icon={<MoreVertical className="h-5 w-5" />} className="h-11 w-11" />}>
          <DropdownItem onClick={onEdit} disabled={!canEdit} icon={<Pencil className="h-4 w-4" />}>
            Edit
          </DropdownItem>
          <DropdownItem
            onClick={onDelete}
            disabled={!canEdit || a.submissionCount > 0}
            danger
            icon={<Trash2 className="h-4 w-4" />}
            description={a.submissionCount > 0 ? "Students have already submitted" : undefined}
          >
            Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </article>
  );
}
