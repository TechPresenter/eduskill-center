import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { withBasePath } from "@/lib/base-path";

export interface PaymentRow {
  id: string;
  paymentNo: string;
  receiptNo: string | null;
  amount: number;
  method: string;
  status: string;
  referenceNo: string | null;
  failureReason: string | null;
  paidAt: Date | string | null;
  createdAt: Date | string;
  application: { id: string; applicationNo: string; course: { name: string } };
}

const RECEIPTABLE = ["COMPLETED", "PENDING", "PROCESSING"];

/** Single payment as a phone card (replaces the 7-column history table below `md`). */
export function PaymentRowCard({ payment: p }: { payment: PaymentRow }) {
  const done = p.status === "COMPLETED";
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-body-sm font-semibold text-navy">{p.paymentNo}</p>
          <p className="text-caption text-muted">{formatDate(p.paidAt ?? p.createdAt)}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <p className="mt-2 text-h3 text-navy tabular-nums">{formatINR(p.amount)}</p>

      <dl className="mt-2 space-y-1 text-body-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Application</dt>
          <dd className="min-w-0 truncate text-right">
            <Link href={`/student/applications/${p.application.id}`} className="font-mono font-semibold text-navy">
              {p.application.applicationNo}
            </Link>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Course</dt>
          <dd className="min-w-0 truncate text-right font-medium text-ink">{p.application.course.name}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Method</dt>
          <dd className="min-w-0 truncate text-right font-medium text-ink">{titleCase(p.method)}</dd>
        </div>
        {p.referenceNo && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Reference</dt>
            <dd className="min-w-0 truncate text-right font-mono text-caption text-ink">{p.referenceNo}</dd>
          </div>
        )}
        {p.receiptNo && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Receipt no.</dt>
            <dd className="min-w-0 truncate text-right font-mono text-caption text-ink">{p.receiptNo}</dd>
          </div>
        )}
      </dl>

      {p.status === "FAILED" && p.failureReason && <p className="mt-2 rounded-md bg-danger-light p-2 text-caption text-red-900">{p.failureReason}</p>}

      {RECEIPTABLE.includes(p.status) && (
        <a
          href={withBasePath(`/api/student/payments/${p.id}/receipt`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line px-4 text-body font-semibold text-navy tap-highlight-none active:bg-surface"
        >
          {done ? <Download className="h-4 w-4" aria-hidden /> : <Receipt className="h-4 w-4" aria-hidden />}
          {done ? "Download receipt" : "Proforma invoice"}
        </a>
      )}
    </li>
  );
}
