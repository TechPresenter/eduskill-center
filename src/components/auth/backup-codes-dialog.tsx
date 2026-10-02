"use client";

import * as React from "react";
import { Check, Copy, Download, KeyRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";

export interface BackupCodesDialogProps {
  open: boolean;
  /** The codes, exactly as the server returned them. They are never stored by this component. */
  codes: string[];
  /** Runs after the person ticks "I have saved them" and presses the button — the only way out. */
  onDone: () => void;
  title?: string;
  description?: React.ReactNode;
  /** Printed at the top of the downloaded file, e.g. "EduSkill Admin — in••@eduskillindia.com". */
  accountLabel?: string;
  /** Name of the downloaded .txt file. */
  fileName?: string;
  doneLabel?: string;
  /** Spinner on the done button while the caller finishes up. */
  loading?: boolean;
}

function codesText(codes: string[], title: string, accountLabel?: string) {
  const lines = [
    title,
    ...(accountLabel ? [accountLabel] : []),
    `Created ${new Date().toLocaleString()}`,
    "",
    "Each code works once, in place of a code from your authenticator app.",
    "Keep this file private and offline. Anyone holding these codes is one step closer to your account.",
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`),
    "",
  ];
  return lines.join("\r\n");
}

/**
 * Shows single-use backup codes ONCE.
 *
 * The dialog cannot be dismissed by Escape, the backdrop or a drag: the codes exist nowhere else, so
 * leaving is a deliberate act — tick "I have saved them", then continue. "Copy all" and "Download .txt"
 * are offered side by side because a phone user usually cannot do the other one.
 */
export function BackupCodesDialog({
  open,
  codes,
  onDone,
  title = "Save your backup codes",
  description = "Use one of these if you ever lose your phone or cannot open your authenticator app.",
  accountLabel,
  fileName = "backup-codes.txt",
  doneLabel = "Continue",
  loading,
}: BackupCodesDialogProps) {
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  // A new set of codes starts unconfirmed (state reset during render, not in an effect).
  const [shownCodes, setShownCodes] = React.useState(codes);
  if (shownCodes !== codes) {
    setShownCodes(codes);
    setSaved(false);
    setCopied(false);
  }

  const copyAll = async () => {
    try {
      // `navigator.clipboard` is undefined on an insecure origin (a LAN address over http).
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      toast.success("Backup codes copied");
    } catch {
      toast.error("Could not copy the codes", "Download the file or write them down instead.");
    }
  };

  const download = () => {
    const blob = new Blob([codesText(codes, title, accountLabel)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => undefined}
      dismissible={false}
      hideClose
      title={title}
      description={description}
      size="md"
      initialFocus="container"
      footer={
        <Button type="button" size="lg" onClick={onDone} disabled={!saved} loading={loading} className="w-full sm:w-auto">
          {doneLabel}
        </Button>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning">These codes are shown only now. Each one works once.</Alert>

        <ol className="grid grid-cols-2 gap-2" aria-label="Backup codes">
          {codes.map((c) => (
            <li
              key={c}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-2 py-2 font-mono text-base font-semibold tracking-wider text-navy tabular-nums select-all"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              {c}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" size="md" onClick={() => void copyAll()} leftIcon={copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}>
            {copied ? "Copied" : "Copy all"}
          </Button>
          <Button type="button" variant="outline" size="md" onClick={download} leftIcon={<Download className="h-4 w-4" aria-hidden />}>
            Download .txt
          </Button>
        </div>

        <Checkbox label="I have saved these backup codes somewhere safe" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
      </div>
    </BottomSheet>
  );
}
