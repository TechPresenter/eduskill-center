"use client";

import { BookMarked, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/icon";
import { formatDate, truncate } from "@/lib/utils";
import { EntityManager } from "@/components/admin/content/entity-manager";
import { IconTile } from "@/components/admin/content/app-list";
import type { FieldDef, FormValues } from "@/components/admin/content/fields";

export interface ProgramRow {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  summary: string;
  content: string | null;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string | Date;
}

const FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "slug", label: "URL slug", type: "slug", from: "title", hint: "Public address: /programs/<slug>" },
  { key: "icon", label: "Icon", type: "icon" },
  { key: "isActive", label: "Shown on the website", type: "boolean" },
  { key: "summary", label: "Summary", type: "textarea", rows: 3, required: true, hint: "One or two sentences shown on program cards." },
  { key: "image", label: "Cover image", type: "image", folder: "programs" },
  { key: "content", label: "Detailed description", type: "textarea", markdown: true, rows: 12 },
];

const toValues = (p: ProgramRow): FormValues => ({ title: p.title, slug: p.slug, icon: p.icon ?? "", summary: p.summary, content: p.content ?? "", image: p.image ?? "", sortOrder: p.sortOrder, isActive: p.isActive });

export function ProgramsManager({ items, canEdit }: { items: ProgramRow[]; canEdit: boolean }) {
  return (
    <EntityManager<ProgramRow>
      items={items}
      endpoint="/api/admin/cms/programs"
      itemLabel="program"
      itemName={(p) => p.title}
      canEdit={canEdit}
      reorder
      fields={FIELDS}
      toValues={toValues}
      emptyValues={{ title: "", slug: "", icon: "", summary: "", content: "", image: "", sortOrder: 0, isActive: true }}
      search={(p) => `${p.title} ${p.slug} ${p.summary}`}
      searchPlaceholder="Search programs"
      segments={[
        { value: "active", label: "Shown", test: (p) => p.isActive },
        { value: "hidden", label: "Hidden", test: (p) => !p.isActive },
      ]}
      emptyIcon={<BookMarked className="h-7 w-7" />}
      row={(p) => ({
        leading: (
          <IconTile tone={p.isActive ? "lavender" : "neutral"}>
            <DynamicIcon name={p.icon ?? undefined} />
          </IconTile>
        ),
        title: p.title,
        subtitle: truncate(p.summary, 120),
        meta: p.isActive ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>,
      })}
      toolbar={`${items.length} program${items.length === 1 ? "" : "s"} · ${items.filter((p) => p.isActive).length} shown on the website`}
      columns={[
        {
          header: "Program",
          render: (p) => (
            <span className="flex items-center gap-3">
              <IconTile size="sm">
                <DynamicIcon name={p.icon ?? undefined} />
              </IconTile>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{p.title}</span>
                <span className="block font-mono text-caption text-muted">/programs/{p.slug}</span>
              </span>
            </span>
          ),
        },
        { header: "Summary", render: (p) => <span className="block max-w-md text-body-sm text-muted">{truncate(p.summary, 140)}</span> },
        { header: "Status", render: (p) => (p.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Hidden</Badge>) },
        { header: "Updated", render: (p) => <span className="whitespace-nowrap text-muted">{formatDate(p.updatedAt)}</span>, className: "whitespace-nowrap" },
      ]}
      toggles={[{ field: "isActive", onLabel: "Show", offLabel: "Hide", icon: <Eye className="h-5 w-5" /> }]}
      links={(p) => (p.isActive ? [{ href: `/programs/${p.slug}`, label: "View on website" }] : [])}
      deleteDescription={(p) => `"${p.title}" will be removed from the website and its detail page will stop working. This cannot be undone.`}
      emptyText="Add the Foundation's programs to show them on the homepage and the Programs page."
    />
  );
}
