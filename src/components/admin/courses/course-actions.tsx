"use client";

import { Archive, CheckCircle2, Eye, PauseCircle, Pencil, Trash2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";

export interface CourseActionTarget {
  id: string;
  code: string;
  name: string;
  status: string;
  batches: number;
  applications: number;
}

export interface CoursePerms {
  update: boolean;
  delete: boolean;
}

function StatusItems({ course, perms }: { course: CourseActionTarget; perms: CoursePerms }) {
  if (!perms.update) return null;
  const url = `/api/admin/courses/${course.id}/status`;
  return (
    <>
      {course.status !== "ACTIVE" && (
        <ConfirmAction asMenuItem icon={<CheckCircle2 className="h-4 w-4" />} method="patch" url={url} body={{ status: "ACTIVE" }} title={`Activate ${course.code}?`} description="The course becomes visible on the website and selectable in applications and batches." confirmLabel="Activate" successMessage="Course activated">
          Activate
        </ConfirmAction>
      )}
      {course.status === "ACTIVE" && (
        <ConfirmAction asMenuItem icon={<PauseCircle className="h-4 w-4" />} method="patch" url={url} body={{ status: "INACTIVE" }} title={`Deactivate ${course.code}?`} description="The course is hidden from the website and cannot be chosen in new applications. Existing batches continue." confirmLabel="Deactivate" successMessage="Course deactivated">
          Deactivate
        </ConfirmAction>
      )}
      {course.status !== "ARCHIVED" && (
        <ConfirmAction asMenuItem icon={<Archive className="h-4 w-4" />} method="patch" url={url} body={{ status: "ARCHIVED" }} title={`Archive ${course.code}?`} description="Archived courses are kept for records and certificates but hidden everywhere else." confirmLabel="Archive" successMessage="Course archived">
          Archive
        </ConfirmAction>
      )}
    </>
  );
}

function DeleteItem({ course, perms, redirectTo }: { course: CourseActionTarget; perms: CoursePerms; redirectTo?: string }) {
  if (!perms.delete) return null;
  const blocked = course.batches > 0 || course.applications > 0;
  return (
    <ConfirmAction asMenuItem danger icon={<Trash2 className="h-4 w-4" />} method="delete" url={`/api/admin/courses/${course.id}`} title={`Delete ${course.code}?`} description={blocked ? `This course has ${course.batches} batch(es) and ${course.applications} application(s). Archive it instead of deleting.` : "The course is removed from every list. Its code can be reused."} confirmLabel="Delete" successMessage="Course deleted" disabled={blocked} redirectTo={redirectTo}>
      Delete
    </ConfirmAction>
  );
}

export function CourseRowActions({ course, perms }: { course: CourseActionTarget; perms: CoursePerms }) {
  return (
    <RecordActions
      label={`Actions for ${course.name}`}
      items={[
        { label: "View", href: `/admin/courses/${course.id}`, icon: <Eye className="h-4 w-4" /> },
        { label: "Edit", href: `/admin/courses/${course.id}/edit`, icon: <Pencil className="h-4 w-4" />, hidden: !perms.update },
      ]}
    >
      <StatusItems course={course} perms={perms} />
      <DeleteItem course={course} perms={perms} />
    </RecordActions>
  );
}

export function CourseHeaderActions({ course, perms }: { course: CourseActionTarget; perms: CoursePerms }) {
  return (
    <>
      {perms.update && (
        <ButtonLink href={`/admin/courses/${course.id}/edit`} variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
          Edit
        </ButtonLink>
      )}
      {perms.update && course.status !== "ACTIVE" && (
        <ConfirmAction size="sm" variant="navy" icon={<CheckCircle2 className="h-4 w-4" />} method="patch" url={`/api/admin/courses/${course.id}/status`} body={{ status: "ACTIVE" }} title={`Activate ${course.code}?`} description="The course becomes visible on the website and selectable in applications and batches." confirmLabel="Activate" successMessage="Course activated">
          Activate
        </ConfirmAction>
      )}
      {(perms.update || perms.delete) && (
        <RecordActions label="More actions">
          <StatusItems course={course} perms={perms} />
          <DeleteItem course={course} perms={perms} redirectTo="/admin/courses" />
        </RecordActions>
      )}
    </>
  );
}
