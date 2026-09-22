"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import type { FormValues } from "@/components/admin/content/fields";

/**
 * One-click boolean flip (publish / feature / activate). The API schemas validate the whole record,
 * so the page passes the item's full form values and only `field` is inverted.
 */
export function QuickToggle({ endpoint, body, field, onLabel, offLabel, disabled, title }: { endpoint: string; body: FormValues; field: string; onLabel: string; offLabel: string; disabled?: boolean; title?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const current = !!body[field];
  const run = async () => {
    setBusy(true);
    try {
      await api.put(endpoint, { ...body, [field]: !current });
      toast.success(current ? offLabel : onLabel);
      router.refresh();
    } catch (err) {
      toast.error("Could not update", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant={current ? "ghost" : "outline"} onClick={run} loading={busy} disabled={disabled} title={title} aria-pressed={current}>
      {current ? offLabel : onLabel}
    </Button>
  );
}
