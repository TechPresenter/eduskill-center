"use client";

import * as React from "react";
import { BadgeCheck, Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { useMutation } from "@/components/admin/pickers/use-mutation";
import { StudentEditDrawer, type StudentEditValues } from "@/components/admin/students/student-edit-drawer";

interface Props {
  studentId: string;
  name: string;
  hasStudentId: boolean;
  canUpdate: boolean;
  initial: StudentEditValues;
}

export function StudentHeaderActions({ studentId, name, hasStudentId, canUpdate, initial }: Props) {
  const { busy, run } = useMutation();
  const [confirm, setConfirm] = React.useState(false);
  const [edit, setEdit] = React.useState(false);
  const title = canUpdate ? undefined : "You do not have permission to edit students";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasStudentId && (
        <Button variant="navy" size="sm" leftIcon={<BadgeCheck className="h-4 w-4" />} onClick={() => setConfirm(true)} disabled={!canUpdate} title={title}>
          Generate Student ID
        </Button>
      )}
      <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)} disabled={!canUpdate} title={title}>
        Edit profile
      </Button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Generate Student ID"
        description={`A permanent Student ID will be generated for ${name}. IDs are sequential and cannot be changed later.`}
        confirmLabel="Generate"
        loading={busy}
        onConfirm={async () => {
          const r = await run(() => api.post<{ studentId: string }>(`/api/admin/students/${studentId}/generate-id`), { success: (d) => `Student ID ${d.studentId} generated` });
          if (r) setConfirm(false);
        }}
      />
      <StudentEditDrawer open={edit} onClose={() => setEdit(false)} studentId={studentId} initial={initial} />
    </div>
  );
}
