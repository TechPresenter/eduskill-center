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
/**
 * Watermark + seal, drawn inline. Concentric navy rings and the Foundation's cap, the same geometry
 * the shared EmptyState mark uses, so the placeholder language is one system. ~0.5KB, no request,
 * no client JS — this sits behind a certificate a student may open on a 2G connection.
 */
function CertificateWatermark() {
  return (
    <svg viewBox="0 0 64 64" className="absolute inset-0 m-auto h-[62%] w-auto opacity-[0.06]" aria-hidden focusable="false">
      <circle cx="32" cy="33" r="27" fill="none" stroke="#12357a" strokeWidth="1.5" />
      <circle cx="32" cy="33" r="21.5" fill="none" stroke="#12357a" strokeWidth="1" />
      <circle cx="32" cy="33" r="14.5" fill="none" stroke="#12357a" strokeWidth="1" />
      <path d="M32 19.5 47 26.5 32 33.5 17 26.5Z" fill="#12357a" />
      <path d="M23.5 30.2v7.3c0 2.9 3.8 5 8.5 5s8.5-2.1 8.5-5v-7.3" fill="none" stroke="#12357a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Stylised A4-landscape preview of the certificate, drawn from the snapshot columns on the row
 * (no PDF rasterisation). Scales down to 328px without clipping; text stays at 12px or above.
 *
 * This is the emotional centre of the screen — the thing a student screenshots and sends home — so
 * it gets the watermark, the ruled corners and a verified seal rather than a plain bordered box.
 */
function CertificatePreview({ c }: { c: CertificateCardData }) {
  const issued = c.status === "ISSUED";
  return (
    <div className="relative aspect-[1.414/1] w-full overflow-hidden rounded-md border border-line bg-white shadow-e1" aria-hidden>
      {/* Inner rule, the way a printed certificate is framed. */}
      <span className="pointer-events-none absolute inset-[6px] rounded-sm border border-navy/15" />
      <div className="relative flex h-full flex-col">
        <div className="surface-tint-dark flex items-center justify-between gap-2 bg-navy px-3 py-1.5 text-white">
          <p className="truncate text-overline">Certificate of Completion</p>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-orange-light" />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 px-3 text-center">
          <CertificateWatermark />
          <p className="text-caption relative text-muted">This is to certify that</p>
          <p className="relative line-clamp-2 font-heading text-[clamp(1rem,5vw,1.5rem)] leading-tight font-extrabold text-navy">{c.studentName}</p>
          <p className="text-caption relative text-muted">has successfully completed</p>
          <p className="text-body-sm relative line-clamp-2 font-bold text-orange">{c.courseName}</p>
          <p className="text-caption relative line-clamp-2 text-muted">
            at {c.centerName} · {c.durationText}
          </p>
          {c.grade && (
            <p className="text-overline relative mt-1 rounded-full bg-lavender px-2.5 py-1 text-navy">Grade {c.grade}</p>
          )}
        </div>

        {/*
         * Seal sits IN the footer row (justify-between centres it) rather than absolutely above it:
         * an overhanging seal collided with the course line once the card narrowed to 360px.
         */}
        <div className="flex items-end justify-between gap-2 border-t-4 border-orange px-3 py-1.5">
          <div className="min-w-0">
            <p className="text-caption truncate font-mono text-muted">{c.certificateNo}</p>
            <p className="text-caption text-muted">{formatDate(c.completionDate)}</p>
          </div>
          {issued && (
            <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-orange bg-white text-orange">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          )}
          <div className="min-w-0 text-right">
            <p className="text-caption truncate font-semibold text-navy">{c.signatoryName}</p>
            <p className="text-caption truncate text-muted">{c.signatoryTitle}</p>
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
      <div className="surface-tint-dark flex items-start justify-between gap-3 border-b-4 border-orange bg-navy px-4 py-3.5 text-white sm:px-5">
        <div className="min-w-0">
          <p className="text-overline text-white/60">Certificate</p>
          <p className="truncate text-h4">{c.courseName}</p>
          <p className="font-mono text-caption text-white/80">{c.certificateNo}</p>
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
          <p className="rounded-md bg-danger-light p-3 text-body-sm text-red-900">
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
