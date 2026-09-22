import * as React from "react";
import Link from "next/link";
import { Award, BadgeCheck, BookOpen, ChevronRight, HelpCircle, History, LayoutGrid, type LucideIcon, Mail, MapPin, Search, UserCheck } from "lucide-react";
import type { SearchResultType } from "@/server/search";
import { cn } from "@/lib/utils";

/*
 * One app-style list row for search: tinted icon tile, bold title over a muted secondary line, an
 * optional tabular code chip and a chevron. Server-safe (no hooks), so the header palette and the
 * /search page render exactly the same row.
 */

export type RowKind = SearchResultType | "recent" | "quick" | "all";

/** Leading icon and tint per kind. Centres use the orange tint so a PIN / code hit stands out. */
export const ROW_ICONS: Record<RowKind, { icon: LucideIcon; tint: "lavender" | "orange" }> = {
  course: { icon: BookOpen, tint: "lavender" },
  centre: { icon: MapPin, tint: "orange" },
  program: { icon: LayoutGrid, tint: "lavender" },
  faq: { icon: HelpCircle, tint: "lavender" },
  recent: { icon: History, tint: "lavender" },
  quick: { icon: ChevronRight, tint: "lavender" },
  all: { icon: Search, tint: "orange" },
};

/** Popular destinations offered before the visitor types anything. Every href is a real page. */
export const QUICK_LINKS: { label: string; subtitle: string; href: string; icon: LucideIcon }[] = [
  { label: "All courses", subtitle: "Browse every skill course", href: "/courses", icon: BookOpen },
  { label: "Find a training centre", subtitle: "By state, district or PIN code", href: "/training-centers", icon: MapPin },
  { label: "Scholarships", subtitle: "Fee support and eligibility", href: "/scholarship", icon: Award },
  { label: "Verify a certificate", subtitle: "Check a certificate number", href: "/verify-certificate", icon: BadgeCheck },
  { label: "Become a trainer", subtitle: "Apply to teach with us", href: "/become-a-trainer", icon: UserCheck },
  { label: "Contact us", subtitle: "Talk to the Foundation", href: "/contact", icon: Mail },
];

export const GROUP_LABELS: Record<SearchResultType, string> = {
  course: "Courses",
  centre: "Training centres",
  program: "Programs",
  faq: "Help & FAQs",
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Emphasises the query words inside `text` (weight + orange, no background, so it reads calmly). */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  const words = query
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map(escapeRegExp);
  if (words.length === 0) return <>{text}</>;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-transparent font-bold text-orange">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export function RowIcon({ kind, icon }: { kind: RowKind; icon?: LucideIcon }) {
  const meta = ROW_ICONS[kind];
  const Icon = icon ?? meta.icon;
  return (
    <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", meta.tint === "orange" ? "bg-orange-light text-orange" : "bg-lavender text-navy")}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export interface ResultRowProps extends Omit<React.ComponentProps<typeof Link>, "title" | "children"> {
  kind: RowKind;
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: LucideIcon;
  /** Words to emphasise in the title. */
  query?: string;
  /** Keyboard-highlighted row inside the palette's listbox. */
  active?: boolean;
}

/** 56px+ on phones, 48px+ from sm. The press state runs on the 150ms micro step. */
export function ResultRow({ kind, title, subtitle, meta, icon, query, active, className, ...linkProps }: ResultRowProps) {
  return (
    <Link
      {...linkProps}
      data-active={active ? "true" : undefined}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left tap-highlight-none sm:min-h-12",
        "transition-colors duration-micro ease-soft motion-reduce:transition-none",
        "hover:bg-surface active:bg-lavender/70 data-[active=true]:bg-lavender/70 ring-focus",
        className
      )}
    >
      <RowIcon kind={kind} icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-ink">{query ? <HighlightMatch text={title} query={query} /> : title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-body-sm text-muted">{subtitle}</span>}
      </span>
      {meta && (
        <span className="hidden shrink-0 rounded-xs bg-surface px-2 py-0.5 text-caption font-semibold text-muted tabular-nums ring-1 ring-line min-[400px]:inline">{meta}</span>
      )}
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted transition-transform duration-micro group-data-[active=true]:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

/** Row-shaped placeholder: tile, title bar and secondary bar, so nothing jumps when results land. */
export function ResultRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul aria-hidden className="space-y-1 px-1">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 px-3 py-2 sm:min-h-12">
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-line/70 motion-reduce:animate-none" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 animate-pulse rounded-xs bg-line/70 motion-reduce:animate-none" style={{ width: `${70 - i * 9}%` }} />
            <span className="block h-3 animate-pulse rounded-xs bg-line/50 motion-reduce:animate-none" style={{ width: `${48 - i * 5}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
