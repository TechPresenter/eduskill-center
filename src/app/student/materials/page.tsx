import type { Metadata } from "next";
import { BookOpen, Download, FileText } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listStudentMaterials } from "@/server/student-portal";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Study Material" };

export default async function StudentMaterialsPage() {
  const user = await requireStudent();
  const materials = await listStudentMaterials(user.student.id);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Study Material" description="Notes, references and files shared by your trainer and the Foundation for your course." />
      {materials.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No study material yet" description="Material shared for your batch or course will appear here." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((m) => (
            <li key={m.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-navy">{m.title}</p>
                  {m.description && <p className="mt-0.5 text-body-sm text-muted">{m.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.fileType && <Badge tone="neutral">{m.fileType.toUpperCase()}</Badge>}
                {m.course && <Badge tone="navy">{m.course.name}</Badge>}
                {m.batch && <Badge tone="neutral">{m.batch.name}</Badge>}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-caption text-muted">
                <span>Added {formatDate(m.createdAt)}</span>
                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-orange hover:underline">
                  <Download className="h-4 w-4" /> Download
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
