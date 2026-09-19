"use client";

import { Badge } from "@/components/ui/badge";
import { EntityManager } from "@/components/admin/content/entity-manager";
import { QuickToggle } from "@/components/admin/content/toggle-action";
import type { FieldDef, FormValues } from "@/components/admin/content/fields";

export interface PartnerRow {
  id: string;
  name: string;
  logoUrl: string;
  website: string | null;
  sortOrder: number;
  isActive: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "name", label: "Partner name", type: "text", required: true },
  { key: "website", label: "Website", type: "url", placeholder: "https://…" },
  { key: "logoUrl", label: "Logo", type: "image", folder: "partners", required: true, hint: "PNG or SVG-style logo with transparent background works best." },
  { key: "sortOrder", label: "Order", type: "number", hint: "Lower numbers appear first." },
  { key: "isActive", label: "Shown on the website", type: "boolean" },
];

const toValues = (p: PartnerRow): FormValues => ({ name: p.name, logoUrl: p.logoUrl, website: p.website ?? "", sortOrder: p.sortOrder, isActive: p.isActive });

export function PartnersManager({ items, canEdit }: { items: PartnerRow[]; canEdit: boolean }) {
  return (
    <EntityManager<PartnerRow>
      items={items}
      endpoint="/api/admin/cms/partners"
      itemLabel="partner"
      itemName={(p) => p.name}
      canEdit={canEdit}
      fields={FIELDS}
      toValues={toValues}
      emptyValues={{ name: "", logoUrl: "", website: "", sortOrder: 0, isActive: true }}
      modalSize="md"
      toolbar={`${items.length} partner${items.length === 1 ? "" : "s"} · ${items.filter((p) => p.isActive).length} shown on the website`}
      columns={[
        {
          header: "Partner",
          render: (p) => (
            <span className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logoUrl} alt="" className="h-10 w-16 rounded-lg border border-line bg-white object-contain p-1" />
              <span className="font-semibold text-ink">{p.name}</span>
            </span>
          ),
        },
        {
          header: "Website",
          render: (p) =>
            p.website ? (
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-navy hover:underline">
                {p.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-xs text-muted">—</span>
            ),
        },
        { header: "Order", render: (p) => <span className="tabular-nums">{p.sortOrder}</span>, className: "text-center" },
        { header: "Status", render: (p) => (p.isActive ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>) },
      ]}
      extraActions={(p) => (canEdit ? <QuickToggle endpoint={`/api/admin/cms/partners/${p.id}`} body={toValues(p)} field="isActive" onLabel="Show" offLabel="Hide" /> : null)}
      emptyText="No partners yet. Add partner organisations to show their logos on the website."
    />
  );
}
