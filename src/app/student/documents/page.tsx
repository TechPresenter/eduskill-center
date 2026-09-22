import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { listStudentDocumentTypes } from "@/server/student-portal";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { DocumentsManager } from "@/components/student/documents-manager";

export const metadata: Metadata = { title: "Documents" };

export default async function StudentDocumentsPage() {
  const user = await requireStudent();
  const [types, documents] = await Promise.all([listStudentDocumentTypes(), db.studentDocument.findMany({ where: { studentId: user.student.id }, orderBy: { createdAt: "desc" } })]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Documents" description="Upload once – your documents are attached to every application. Verified documents cannot be removed." backHref="/student/profile" />
      <Alert tone="info">Accepted formats: PDF, JPG or PNG up to 5 MB. Make sure the scan is clear and all four corners are visible.</Alert>
      <DocumentsManager
        types={types.map((t) => ({ key: t.key, name: t.name, description: t.description, isRequired: t.isRequired }))}
        documents={documents.map((d) => ({ id: d.id, type: d.type, name: d.name, url: d.url, status: d.status, remarks: d.remarks, createdAt: d.createdAt.toISOString(), size: d.size, mimeType: d.mimeType }))}
      />
    </div>
  );
}
