import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile as UiIconTile, type IconTileTone } from "@/components/ui/list";

/*
 * App-style list and record building blocks for the operational admin screens.
 *
 * These live here (rather than in `admin/shared`) only because of file ownership during the redesign;
 * nothing in them is location-specific. See redesign-requests/admin-screens.md for the proposal to move
 * them into `@/components/admin/shared`. Every export is server-safe: no hooks, no "use client", so a
 * server page can render them directly inside `TableWrap` rows.
 *
 * Motion: the only movement is a 150ms background change on press. No transforms, so a row never
 * becomes a containing block for anything position:fixed that a row action might open.
 */

export type TileTone = Extract<IconTileTone, "lavender" | "orange" | "success" | "warning" | "danger" | "neutral">;

/** A Lucide icon in a soft tinted rounded square: the kit's IconTile with this module's call style. */
export function IconTile({ icon, tone = "lavender", size = "md", className }: { icon: React.ReactNode; tone?: TileTone; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <UiIconTile tone={tone} size={size} className={className}>
      {icon}
    </UiIconTile>
  );
}

export interface RowLeadProps {
  /** Leading visual: an `<IconTile>` or an `<Avatar>`. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  /** Secondary line (code, parent, contact). Muted, caption size. */
  meta?: React.ReactNode;
  /** Third line, for a short status note (a failure reason, a due date). */
  note?: React.ReactNode;
  /** Trailing value/status shown on phones only (the matching table columns are `mobile="hidden"`). */
  trailing?: React.ReactNode;
  /** Makes the lead + title block a link. Trailing content stays outside it so it can hold controls. */
  href?: string;
  /** Show a chevron after the trailing slot on phones (only when `href` is set). Default true. */
  chevron?: boolean;
  className?: string;
}

/**
 * The title cell of an app-style list row: leading tile/avatar, a strong title over a muted secondary
 * line, and a trailing value or status. Put it in `<TD primary>`. On phones the row card reads like a
 * native list item (56px+ tall, one tap target); at `md`+ it is an ordinary first table cell.
 */
export function RowLead({ lead, title, meta, note, trailing, href, chevron = true, className }: RowLeadProps) {
  const text = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="text-body block font-semibold break-words text-navy md:text-body-sm md:text-ink md:group-hover:text-navy">{title}</span>
        {meta && <span className="text-caption mt-0.5 block font-normal break-words text-muted">{meta}</span>}
        {note && <span className="text-caption mt-0.5 block font-normal">{note}</span>}
      </span>
    </>
  );
  return (
    <span className={cn("flex min-h-12 items-center gap-3", className)}>
      {href ? (
        <Link
          href={href}
          className="group ring-focus -m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 tap-highlight-none transition-colors duration-micro active:bg-surface motion-reduce:transition-none"
        >
          {text}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{text}</span>
      )}
      {(trailing || (href && chevron)) && (
        <span className="flex shrink-0 items-center gap-1 text-right md:hidden">
          {trailing}
          {href && chevron && <ChevronRight className="h-4 w-4 text-muted" aria-hidden />}
        </span>
      )}
    </span>
  );
}

/**
 * The record's identity on phones, where the app bar only has room for a code. Detail pages render it
 * straight under `PageHeader`: avatar or tile, the record's name, a secondary line and its status badges.
 * Hidden from `lg`, where the page header shows the same thing.
 */
export function RecordIdentity({ lead, title, meta, badges, className }: { lead?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; badges?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card mb-4 flex items-center gap-3 p-4 lg:hidden", className)}>
      {lead}
      <div className="min-w-0 flex-1">
        <h2 className="text-h4 break-words text-navy">{title}</h2>
        {meta && <p className="text-caption mt-0.5 break-words text-muted">{meta}</p>}
        {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
      </div>
    </div>
  );
}
