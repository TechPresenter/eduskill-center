"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Download, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/admin/pickers/reason-dialog";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { useMutation } from "@/components/admin/pickers/use-mutation";
import { withBasePath } from "@/lib/base-path";

/** Download / verify / revoke controls for an issued certificate. */
export function CertificateRowActions({ certificateId, certificateNo, status, canRevoke }: { certificateId: string; certificateNo: string; status: string; canRevoke: boolean }) {
  const [revoke, setRevoke] = React.useState(false);
  const { busy, fieldErrors, run, clearErrors } = useMutation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a href={withBasePath(`/api/admin/certificates/${certificateId}/download?download=1`)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink hover:bg-surface" aria-label={`Download certificate ${certificateNo}`}>
        <Download className="h-3.5 w-3.5" /> PDF
      </a>
      <Link href={`/verify-certificate/${certificateNo}`} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-navy hover:bg-surface" aria-label={`Open public verification page for ${certificateNo}`}>
        <ShieldCheck className="h-3.5 w-3.5" /> Verify
      </Link>
      {status === "ISSUED" && (
        <Gate allowed={canRevoke} reason="You do not have permission to revoke certificates">
          <Button size="xs" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => setRevoke(true)}>
            Revoke
          </Button>
        </Gate>
      )}
      <ReasonDialog
        open={revoke}
        onClose={() => {
          clearErrors();
          setRevoke(false);
        }}
        title={`Revoke ${certificateNo}`}
        description="The public verification page will show the certificate as revoked with this reason. This cannot be undone."
        label="Reason"
        minLength={5}
        confirmLabel="Revoke certificate"
        danger
        loading={busy}
        error={fieldErrors.reason}
        onConfirm={async (reason) => {
          const r = await run(() => api.post(`/api/admin/certificates/${certificateId}/revoke`, { reason }), { success: "Certificate revoked" });
          if (r !== undefined) setRevoke(false);
        }}
      />
    </div>
  );
}
