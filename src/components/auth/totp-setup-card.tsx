"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface TotpSetupCardProps {
  /** PNG data URL of the otpauth:// QR code (from the server's set-up payload). */
  qrDataUrl: string;
  /** The same secret grouped for typing: "ABCD EFGH …". */
  manualKey: string;
  issuer: string;
  account: string;
  className?: string;
}

/** Mirrors `otpauthUri()` in src/lib/auth/totp.ts (a server module) for the "open in app" link. */
function otpauthHref(issuer: string, account: string, manualKey: string) {
  const name = issuer.replace(/:/g, "").trim() || "EduSkill";
  const params = new URLSearchParams({ secret: manualKey.replace(/\s/g, ""), issuer: name, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${encodeURIComponent(name)}:${encodeURIComponent(account)}?${params.toString()}`;
}

/**
 * Authenticator set-up: scan the QR code, or type the key by hand.
 *
 * On a phone the QR code is on the same screen as the app that should scan it, so the manual key
 * (with a copy button) carries equal weight, and a touch device also gets "Open in authenticator app"
 * — the otpauth:// link Google and Microsoft Authenticator register for.
 *
 * The secret is only on screen while set-up is unfinished; the server never returns it again.
 */
export function TotpSetupCard({ qrDataUrl, manualKey, issuer, account, className }: TotpSetupCardProps) {
  const [copied, setCopied] = React.useState(false);

  const copyKey = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(manualKey.replace(/\s/g, ""));
      setCopied(true);
      toast.success("Set-up key copied");
    } catch {
      toast.error("Could not copy the key", "Select it and copy it by hand instead.");
    }
  };

  return (
    <div className={cn("rounded-card border border-line bg-white p-4 sm:p-5", className)}>
      <ol className="space-y-4">
        <li className="flex gap-3">
          <StepNumber n={1} />
          <p className="text-body-sm min-w-0 pt-1 text-ink">
            Open <strong className="font-semibold">Google Authenticator</strong>, <strong className="font-semibold">Microsoft Authenticator</strong> or another
            authenticator app and choose to add an account.
          </p>
        </li>
        <li className="flex gap-3">
          <StepNumber n={2} />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-body-sm text-ink">Scan this QR code with the app.</p>
            <div className="mt-3 flex justify-center sm:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- a server-generated data URL, nothing to optimise */}
              <img
                src={qrDataUrl}
                alt={`QR code that adds ${issuer} (${account}) to an authenticator app`}
                width={192}
                height={192}
                className="h-48 w-48 rounded-md border border-line bg-white p-2"
              />
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <StepNumber n={3} />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-body-sm text-ink">Cannot scan it? Enter this key instead (time-based).</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2.5 font-mono text-base font-semibold tracking-wider break-all text-navy select-all">
                {manualKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => void copyKey()}
                leftIcon={copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                aria-label={copied ? "Set-up key copied" : "Copy set-up key"}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-caption mt-2 text-muted">
              Account: <span className="font-medium text-ink">{issuer}</span> · <span className="break-all">{account}</span>
            </p>
            <a
              href={otpauthHref(issuer, account, manualKey)}
              className="text-body-sm ring-focus mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md font-semibold text-orange hover:underline pointer-fine:hidden"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open in authenticator app
            </a>
          </div>
        </li>
      </ol>
      <p className="text-caption mt-4 flex items-start gap-2 text-muted">
        <QrCode className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Then type the 6-digit code the app shows below. It changes every 30 seconds.
      </p>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="text-body-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender font-bold text-navy" aria-hidden>
      {n}
    </span>
  );
}
