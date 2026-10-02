"use client";

import * as React from "react";
import { Check, Copy, Download } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";

/**
 * Shows freshly created backup codes exactly once. The codes live only in the caller's state: they are
 * never stored by the browser, and the dialog cannot be dismissed (no X, no Escape, no backdrop) until
 * the administrator ticks "I have saved them" — closing it is the last time they can be seen.
 * Render it with a `key` per set of codes so the checkbox starts unticked for every new set.
 */
export function BackupCodesDialog({ codes, onDone }: { codes: string[] | null; onDone: () => void }) {
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const open = !!codes && codes.length > 0;

  const copyAll = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard", "Select the codes and copy them, or download the file instead.");
    }
  };

  const download = () => {
    if (!codes) return;
    const text = [
      "Two-factor backup codes (admin panel)",
      `Created ${formatDateTime(new Date())}`,
      "Each code works once. Keep them somewhere safe and private.",
      "",
      ...codes,
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (saved) onDone();
      }}
      dismissible={false}
      hideClose
      title="Save your backup codes"
      description="If you lose your phone, each code signs you in once in place of an authenticator code."
      footer={
        <Button type="button" size="md" disabled={!saved} onClick={onDone}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning">This is the only time these codes are shown. Copy or download them now — they cannot be displayed again.</Alert>
        <ol className="grid grid-cols-2 gap-2" aria-label="Backup codes">
          {(codes ?? []).map((c) => (
            <li key={c} className="rounded-md border border-line bg-surface px-3 py-2 text-center font-mono text-base font-semibold tracking-wider text-ink select-all">
              {c}
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={copyAll} leftIcon={copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}>
            {copied ? "Copied" : "Copy all"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download} leftIcon={<Download className="h-4 w-4" />}>
            Download .txt
          </Button>
        </div>
        <Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} label="I have saved these codes somewhere safe" />
      </div>
    </BottomSheet>
  );
}
