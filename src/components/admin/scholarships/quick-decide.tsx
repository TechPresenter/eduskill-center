"use client";

import * as React from "react";
import { Award } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/modal";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { ScholarshipDecisionForm, type ScholarshipProgramOption } from "@/components/admin/applications/scholarship-panel";

export interface QuickDecideProps {
  applicationId: string;
  applicationNo: string;
  studentName: string;
  courseName: string;
  originalFee: number;
  discountAmount: number;
  reason: string | null;
  programs: ScholarshipProgramOption[];
  allowed: boolean;
}

/** "Decide" button on the pending-requests list – same rules as the application's scholarship panel. */
export function QuickDecideButton(p: QuickDecideProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Gate allowed={p.allowed} reason="You do not have permission to decide scholarships">
        <Button size="sm" variant="secondary" leftIcon={<Award className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
          Decide
        </Button>
      </Gate>
      {open && (
        <Drawer open onClose={() => setOpen(false)} title="Scholarship decision" description={`${p.studentName} · ${p.courseName} · ${p.applicationNo} · fee ${formatINR(p.originalFee)}`} className="max-w-xl">
          {p.reason && (
            <div className="mb-4 rounded-md bg-surface p-3 text-body-sm">
              <p className="text-caption font-medium text-muted uppercase">Student&apos;s reason</p>
              <p className="mt-0.5 whitespace-pre-line text-ink">{p.reason}</p>
            </div>
          )}
          <ScholarshipDecisionForm endpoint="/api/admin/scholarships/decide" extraBody={{ applicationId: p.applicationId }} originalFee={p.originalFee} discountAmount={p.discountAmount} programs={p.programs} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Drawer>
      )}
    </>
  );
}
