"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Copies `text` to the clipboard. On phones it is a 44px `IconButton` (labels would push the row
 * out of a card); from `md` up the labelled outline button is shown.
 */
export function CopyButton({ text, label = "Copy", size = "xs" }: { text: string; label?: string; size?: "xs" | "sm" }) {
  const [done, setDone] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };
  const icon = done ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />;
  return (
    <>
      <IconButton type="button" variant="outline" size="md" onClick={copy} icon={icon} aria-label={done ? "Copied to clipboard" : `${label} to clipboard`} className="md:hidden" />
      <Button type="button" variant="outline" size={size} onClick={copy} leftIcon={done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} aria-label={`${label} to clipboard`} className="hidden md:inline-flex">
        {done ? "Copied" : label}
      </Button>
    </>
  );
}
