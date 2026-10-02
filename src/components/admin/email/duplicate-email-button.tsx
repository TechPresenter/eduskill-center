"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { EmailAttachment, EmailMessageResult } from "@/components/admin/email/types";

export interface DuplicateSource {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  includeSignature: boolean;
  attachments: EmailAttachment[];
  templateId: string | null;
  isTest: boolean;
}

/**
 * "Duplicate as new email": saves a copy of a sent email as a NEW draft and opens it in Compose.
 * Only the administrator's own uploads can be attached (the server enforces it), so attachments
 * another administrator uploaded are left out, and say so.
 */
export function DuplicateEmailButton({ source, userId, className }: { source: DuplicateSource; userId: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    setBusy(true);
    const own = source.attachments.filter((a) => a.key.startsWith(`private/email/${userId}/`));
    const dropped = source.attachments.length - own.length;
    try {
      const draft = await api.post<EmailMessageResult>("/api/admin/email/drafts", {
        to: source.to,
        cc: source.cc,
        bcc: source.bcc,
        subject: source.isTest ? source.subject.replace(/^\[TEST\]\s*/, "") : source.subject,
        html: source.html,
        includeSignature: source.includeSignature,
        attachments: own.map(({ key, name, size, mimeType }) => ({ key, name, size, mimeType })),
        templateId: source.templateId,
      });
      if (dropped > 0) toast.warning("Copied to a new draft", `${dropped} attachment${dropped === 1 ? " was" : "s were"} uploaded by another administrator and not copied. Attach ${dropped === 1 ? "it" : "them"} again if needed.`);
      else toast.success("Copied to a new draft", "Edit it and send when ready.");
      router.push(`/admin/email?draft=${draft.id}`);
    } catch (err) {
      toast.error("Could not duplicate the email", errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={run} loading={busy} leftIcon={<CopyPlus className="h-4 w-4" />} className={className}>
      Duplicate as new email
    </Button>
  );
}
