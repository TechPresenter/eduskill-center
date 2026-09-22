import Link from "next/link";
import type { LucideProps } from "lucide-react";
import { IconTile, type IconTileTone } from "@/components/ui/list";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  href: string;
  icon: React.ComponentType<LucideProps>;
  tone: IconTileTone;
}

/**
 * The heart of the phone home screen: the main jobs one tap away, as tinted icon tiles with short
 * labels — three per row on phones, one row of six from `sm`. Every tile is a full-size link (well over
 * 44px), pressed with the shared colour-only `press` state (no transform, so nothing here can become a
 * containing block for the header's fixed sheets).
 */
export function QuickActions({ actions, className }: { actions: QuickAction[]; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <nav aria-label="Quick actions" className={cn("card p-2", className)}>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {actions.map((a) => (
          <li key={a.href + a.label}>
            <Link href={a.href} className="press ring-focus-inset flex h-full min-h-24 flex-col items-center gap-2 rounded-lg px-1 pt-3 pb-2.5 text-center">
              <IconTile icon={a.icon} tone={a.tone} size="lg" />
              <span className="text-body-sm leading-tight font-semibold text-ink">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
