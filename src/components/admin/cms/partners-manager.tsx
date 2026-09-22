"use client";

import { Eye, Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { withBasePath } from "@/lib/base-path";
import { EntityManager } from "@/components/admin/content/entity-manager";
import type { FieldDef, FormValues } from "@/components/admin/content/fields";

/** Logo thumbnail: contained (never cropped) on white, the same frame in the list and the table. */
function Logo({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={withBasePath(src)} alt="" loading="lazy" className="h-11 w-16 shrink-0 rounded-md border border-line bg-white object-contain p-1" />
  );
}

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
      search={(p) => `${p.name} ${p.website ?? ""}`}
      searchPlaceholder="Search partners"
      segments={[
        { value: "shown", label: "Shown", test: (p) => p.isActive },
        { value: "hidden", label: "Hidden", test: (p) => !p.isActive },
      ]}
      emptyIcon={<Handshake className="h-7 w-7" />}
      row={(p) => ({
        leading: <Logo src={p.logoUrl} />,
        title: p.name,
        subtitle: p.website ? p.website.replace(/^https?:\/\//, "") : "No website",
        trailing: p.isActive ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>,
      })}
      toggles={[{ field: "isActive", onLabel: "Show", offLabel: "Hide", icon: <Eye className="h-5 w-5" /> }]}
      toolbar={`${items.length} partner${items.length === 1 ? "" : "s"} · ${items.filter((p) => p.isActive).length} shown on the website`}
      columns={[
        {
          header: "Partner",
          render: (p) => (
            <span className="flex items-center gap-3">
              <Logo src={p.logoUrl} />
              <span className="font-semibold text-ink">{p.name}</span>
            </span>
          ),
        },
        {
          header: "Website",
          render: (p) =>
            p.website ? (
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-body-sm text-navy hover:underline md:min-h-0">
                {p.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-caption text-muted">—</span>
            ),
        },
        { header: "Order", render: (p) => <span className="tabular-nums">{p.sortOrder}</span>, className: "text-center" },
        { header: "Status", render: (p) => (p.isActive ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>) },
      ]}
      emptyText="Add partner and supporter organisations to show their logos in the website's partner strip."
    />
  );
}
