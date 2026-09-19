import { ShieldCheck } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { CertificateShare } from "@/components/student/certificate-share";

export interface CertificateCardData {
  id: string;
  certificateNo: string;
  studentName: string;
  courseName: string;
  centerName: string;
  centerCode: string;
  durationText: string;
  grade: string | null;
  signatoryName: string;
  signatoryTitle: string;
  status: string;
  completionDate: Date | string;
  issuedAt: Date | string;
  revokedAt: Date | string | null;
  revokedReason: string | null;
  admissionNo?: string | null;
  batchLabel?: string | null;
}

/**
 * Stylised A4-landscape preview of the certificate, drawn from the snapshot columns on the row
 * (no PDF rasterisation). Scales down to 328px without clipping; text stays at 12px or above.
 */
function CertificatePreview({ c }: { c: CertificateCardData }) {
  return (
    <div className="aspect-[1.414/1] w-full overflow-hidden rounded-xl border border-line bg-white" aria-hidden>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 bg-navy px-3 py-1.5 text-white">
          <p className="truncate text-[12px] font-bold tracking-[0.14em] uppercase">Certificate of Completion</p>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-orange-light" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 px-3 text-center">
          <p className="text-[12px] text-muted">This is to certify that</p>
          <p className="line-clamp-2 font-heading text-[clamp(1rem,5vw,1.5rem)] leading-tight font-extrabold text-navy">{c.studentName}</p>
          <p className="text-[12px] text-muted">has successfully completed</p>
          <p className="line-clamp-2 text-[13px] font-bold text-orange">{c.courseName}</p>
          <p className="line-clamp-2 text-[12px] text-muted">
            at {c.centerName} · {c.durationText}
          </p>
        </div>
        <div className="flex items-end justify-between gap-2 border-t-4 border-orange px-3 py-1.5">
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] text-muted">{c.certificateNo}</p>
            <p className="text-[12px] text-muted">{formatDate(c.completionDate)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-[12px] font-semibold text-navy">{c.signatoryName}</p>
            <p className="truncate text-[12px] text-muted">{c.signatoryTitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One certificate: navy header, visual preview, the snapshot details and the
 * Verify / Download / Share action row.
 */
export function CertificateCard({ certificate: c, verifyUrl, verifyPath, className }: { certificate: CertificateCardData; verifyUrl: string; verifyPath: string; className?: string }) {
  const issued = c.status === "ISSUED";
  return (
    <li className={cn("card overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b-4 border-orange bg-navy px-4 py-3.5 text-white sm:px-5">
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.18em] text-white/60 uppercase">Certificate</p>
          <p className="truncate font-heading text-[17px] font-extrabold">{c.courseName}</p>
          <p className="font-mono text-[12px] text-white/80">{c.certificateNo}</p>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <CertificatePreview c={c} />

        <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
          <KeyValue label="Issued to" value={c.studentName} />
          <KeyValue label="Grade" value={c.grade ?? "—"} />
          <KeyValue label="Center" value={`${c.centerName} (${c.centerCode})`} />
          <KeyValue label="Duration" value={c.durationText} />
          <KeyValue label="Completed on" value={formatDate(c.completionDate)} />
          <KeyValue label="Issued on" value={formatDate(c.issuedAt)} />
          {c.batchLabel && <KeyValue label="Batch" value={c.batchLabel} />}
          {c.admissionNo && <KeyValue label="Admission" value={c.admissionNo} />}
        </dl>

        {c.status === "REVOKED" && (
          <p className="rounded-lg bg-danger-light p-3 text-[13px] text-red-900">
            This certificate was revoked{c.revokedAt ? ` on ${formatDate(c.revokedAt)}` : ""}
            {c.revokedReason ? `: ${c.revokedReason}` : "."}
          </p>
        )}

        <CertificateShare
          certificateNo={c.certificateNo}
          courseName={c.courseName}
          studentName={c.studentName}
          verifyUrl={verifyUrl}
          verifyPath={verifyPath}
          downloadUrl={issued ? `/api/student/certificates/${c.id}/download` : null}
        />
      </div>
    </li>
  );
}
