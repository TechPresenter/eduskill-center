import type { Metadata } from "next";
import { Award } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { CertificateCard } from "@/components/student/certificate-card";

export const metadata: Metadata = { title: "Certificates" };

export default async function StudentCertificatesPage() {
  const user = await requireStudent();
  const certificates = await db.certificate.findMany({
    where: { studentId: user.student.id },
    orderBy: { issuedAt: "desc" },
    include: { admission: { select: { admissionNo: true, batch: { select: { name: true, code: true } } } } },
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Certificates" mobileTitle="Certificates" description="Certificates issued by the Foundation. Anyone can verify them online using the certificate number or QR code." />
      {certificates.length === 0 ? (
        <EmptyState
          icon={<Award className="h-7 w-7" />}
          title="No certificates yet"
          description="Certificates are issued after you complete a course with the required attendance and assessment marks."
          action={<ButtonLink href="/student/progress" variant="outline">View progress</ButtonLink>}
        />
      ) : (
        <ul className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {certificates.map((c) => {
            const verifyPath = `/verify-certificate/${c.certificateNo}`;
            return (
              <CertificateCard
                key={c.id}
                certificate={{
                  id: c.id,
                  certificateNo: c.certificateNo,
                  studentName: c.studentName,
                  courseName: c.courseName,
                  centerName: c.centerName,
                  centerCode: c.centerCode,
                  durationText: c.durationText,
                  grade: c.grade,
                  signatoryName: c.signatoryName,
                  signatoryTitle: c.signatoryTitle,
                  status: c.status,
                  completionDate: c.completionDate,
                  issuedAt: c.issuedAt,
                  revokedAt: c.revokedAt,
                  revokedReason: c.revokedReason,
                  admissionNo: c.admission.admissionNo,
                  batchLabel: `${c.admission.batch.name} (${c.admission.batch.code})`,
                }}
                verifyPath={verifyPath}
                verifyUrl={absoluteUrl(verifyPath)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
