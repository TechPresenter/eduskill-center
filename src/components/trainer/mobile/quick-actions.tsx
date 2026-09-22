import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrainerQuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Small orange line under the label (pending count, percentage…). Never a placeholder. */
  badge?: string | number | null;
  /** Amber tile tint when the trainer has something outstanding. */
  attention?: boolean;
}

/**
 * Android-style 2-column launcher grid for the trainer phone home — the same component contract as the
 * student portal's QuickActions so the two homes feel like one product. Every tile is at least 72px
 * tall (well over the 44px target) and no label drops below 12px.
 */
export function TrainerQuickActions({ items, label = "Quick actions", className }: { items: TrainerQuickAction[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("grid grid-cols-2 gap-3", className)}>
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="card card-hover relative flex min-h-[72px] items-center gap-3 p-3 tap-highlight-none">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.attention ? "bg-warning-light text-amber-700" : "bg-lavender text-navy")}>
            <item.icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-body-sm font-semibold text-ink">{item.label}</span>
            {item.badge !== undefined && item.badge !== null && item.badge !== "" && <span className="mt-0.5 block truncate text-caption font-bold text-orange tabular-nums">{item.badge}</span>}
          </span>
        </Link>
      ))}
    </nav>
  );
}
