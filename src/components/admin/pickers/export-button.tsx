import { Download } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Plain anchor to a CSV endpoint (bypasses client navigation). Disabled state explains the missing permission. */
export function ExportButton({ href, label = "Export CSV", disabled, className }: { href: string; label?: string; disabled?: boolean; className?: string }) {
  if (disabled) {
    return (
      <span title="You do not have the export permission" className={cn(buttonClasses({ variant: "outline", size: "sm" }), "cursor-not-allowed opacity-50", className)} aria-disabled="true">
        <Download className="h-4 w-4" /> {label}
      </span>
    );
  }
  return (
    <a href={href} className={cn(buttonClasses({ variant: "outline", size: "sm" }), className)} download>
      <Download className="h-4 w-4" /> {label}
    </a>
  );
}
