"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Share2, ShieldCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

export interface CertificateShareProps {
  certificateNo: string;
  courseName: string;
  studentName: string;
  /** Absolute verification URL – the thing that actually gets shared. */
  verifyUrl: string;
  /** In-app path so "Verify" works without a configured public origin. */
  verifyPath: string;
  /** `null` while the certificate is not issued (revoked certificates have no download). */
  downloadUrl: string | null;
}

/**
 * Verify / Download / Share row. Share prefers the Web Share API, falls back to the clipboard with a
 * toast, and finally to a dialog showing the URL for manual copying.
 */
export function CertificateShare({ certificateNo, courseName, studentName, verifyUrl, verifyPath, downloadUrl }: CertificateShareProps) {
  const [fallbackOpen, setFallbackOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const share = async () => {
    const payload = {
      title: `${courseName} certificate`,
      text: `Certificate ${certificateNo} issued to ${studentName}. Verify it online:`,
      url: verifyUrl,
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        // A user-cancelled share is not an error worth reporting.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast.success("Verification link copied", "Paste it anywhere to let others verify this certificate.");
      return;
    } catch {
      setFallbackOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Link
          href={verifyPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border border-line px-1 text-caption font-semibold text-navy tap-highlight-none active:bg-surface"
        >
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden /> Verify
        </Link>
        {downloadUrl ? (
          <ButtonLink href={downloadUrl} target="_blank" rel="noopener noreferrer" variant="navy" className="flex-col gap-0.5 px-1 text-caption">
            <Download className="h-[18px] w-[18px]" aria-hidden /> Download
          </ButtonLink>
        ) : (
          <span className="inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-line px-1 text-caption font-semibold text-muted">
            <Download className="h-[18px] w-[18px]" aria-hidden /> Download
          </span>
        )}
        <Button variant="outline" onClick={() => void share()} className="flex-col gap-0.5 px-1 text-caption" aria-label={`Share certificate ${certificateNo}`}>
          <Share2 className="h-[18px] w-[18px]" aria-hidden /> Share
        </Button>
      </div>

      <Modal
        open={fallbackOpen}
        onClose={() => setFallbackOpen(false)}
        title="Share this certificate"
        description="Copy the verification link and send it to anyone who needs to check your certificate."
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setFallbackOpen(false)}>
            Close
          </Button>
        }
      >
        <Input ref={inputRef} readOnly value={verifyUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Verification link" />
      </Modal>
    </>
  );
}
