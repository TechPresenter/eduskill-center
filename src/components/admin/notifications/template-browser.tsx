"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Bell, ClipboardCheck, CreditCard, FileText, GraduationCap, Mail, MessageCircle, MessageSquare, Search, Settings2, UserCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { cn, formatDate } from "@/lib/utils";
import { EVENT_CATEGORY, NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/categories";
import { IconTile, ListSection } from "@/components/admin/content/app-list";

export interface TemplateChannelState {
  channel: string;
  key: string;
  custom: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface TemplateEventRow {
  event: string;
  name: string;
  variables: string[];
  channels: TemplateChannelState[];
}

export const CHANNEL_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  EMAIL: { label: "Email", icon: Mail },
  SMS: { label: "SMS", icon: MessageSquare },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  IN_APP: { label: "In-app", icon: Bell },
};

const CATEGORY_ICON: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  Application: FileText,
  Admission: UserCheck,
  Payment: CreditCard,
  Training: GraduationCap,
  Attendance: ClipboardCheck,
  Certificate: Award,
  System: Settings2,
};

const categoryOfEvent = (event: string): NotificationCategory => (EVENT_CATEGORY as Record<string, NotificationCategory | undefined>)[event] ?? "System";

/** One tappable channel chip: state dot + icon + label. 44px tall on phones. */
function ChannelChip({ c, eventName, canEdit }: { c: TemplateChannelState; eventName: string; canEdit: boolean }) {
  const meta = CHANNEL_META[c.channel] ?? { label: c.channel, icon: Bell };
  const Icon = meta.icon;
  const state = !c.isActive ? "Inactive" : c.custom ? "Custom" : "Default";
  return (
    <Link
      href={`/admin/notifications/templates/${encodeURIComponent(c.key)}`}
      aria-label={`${canEdit ? "Edit" : "View"} the ${meta.label} template for ${eventName} (${state.toLowerCase()})`}
      title={c.updatedAt ? `${state} · saved ${formatDate(c.updatedAt)}` : state}
      className={cn(
        "ring-focus inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-body-sm font-semibold tap-highlight-none transition-colors duration-micro ease-soft motion-reduce:transition-none md:min-h-9",
        !c.isActive ? "border-warning/30 bg-warning-light text-warning-dark" : c.custom ? "border-orange/25 bg-orange-light text-orange" : "border-line bg-white text-ink hover:border-navy/40 hover:bg-surface",
        "active:scale-[0.98]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{meta.label}</span>
      <span className="sr-only md:not-sr-only md:text-caption md:font-medium md:opacity-80">· {state}</span>
    </Link>
  );
}

/**
 * The template library: every automatic message grouped by what it is about (application, payment…),
 * with an in-page search and category chips. Each event is one card row whose four channel chips go
 * straight to that channel's editor; orange means customised, amber means switched off.
 */
export function TemplateBrowser({ templates, canEdit }: { templates: TemplateEventRow[]; canEdit: boolean }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const needle = query.trim().toLowerCase();

  const counts = new Map<NotificationCategory, number>();
  for (const t of templates) counts.set(categoryOfEvent(t.event), (counts.get(categoryOfEvent(t.event)) ?? 0) + 1);

  const visible = templates.filter((t) => (category === "all" || categoryOfEvent(t.event) === category) && (!needle || `${t.name} ${t.event} ${t.variables.join(" ")}`.toLowerCase().includes(needle)));
  const groups = NOTIFICATION_CATEGORIES.map((c) => ({ category: c, rows: visible.filter((t) => categoryOfEvent(t.event) === c) })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="w-full sm:max-w-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search messages or variables, e.g. payment, otp, batchName"
            aria-label="Search templates"
            leftIcon={<Search className="h-4 w-4" />}
            rightIcon={
              query ? (
                <button type="button" onClick={() => setQuery("")} className="ring-focus -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />
        </div>
        <SegmentedControl
          scrollable
          className="max-w-full"
          value={category}
          onChange={setCategory}
          items={[{ value: "all", label: `All · ${templates.length}` }, ...NOTIFICATION_CATEGORIES.filter((c) => counts.get(c)).map((c) => ({ value: c, label: `${c} · ${counts.get(c)}` }))]}
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Search className="h-6 w-6" />}
          title="No templates match"
          description="Try another word, or clear the search to see every automatic message."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        groups.map((g) => {
          const Icon = CATEGORY_ICON[g.category];
          return (
            <ListSection key={g.category} id={`tpl-${g.category}`} title={g.category} count={g.rows.length}>
              <ul aria-labelledby={`tpl-${g.category}`} className="card animate-fade-in divide-y divide-line overflow-hidden motion-reduce:animate-none">
                {g.rows.map((t) => {
                  const customised = t.channels.filter((c) => c.custom).length;
                  return (
                    <li key={t.event} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <IconTile tone={customised ? "orange" : "lavender"}>
                          <Icon />
                        </IconTile>
                        <div className="min-w-0">
                          <p className="text-body font-semibold text-ink">{t.name}</p>
                          <p className="truncate text-caption text-muted">
                            <span className="font-mono">{t.event}</span> · {t.variables.length} variable{t.variables.length === 1 ? "" : "s"}
                            {customised ? ` · ${customised} customised` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                        {t.channels.map((c) => (
                          <ChannelChip key={c.key} c={c} eventName={t.name} canEdit={canEdit} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ListSection>
          );
        })
      )}
    </div>
  );
}
