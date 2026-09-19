"use client";

import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/stats";
import { formatDate, formatINR } from "@/lib/utils";
import { EntityManager } from "@/components/admin/content/entity-manager";
import { QuickToggle } from "@/components/admin/content/toggle-action";
import { toDateInput, type FieldDef, type FormValues } from "@/components/admin/content/fields";

export interface CampaignRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image: string | null;
  goalAmount: number | null;
  raisedAmount: number;
  startDate: string | Date | null;
  endDate: string | Date | null;
  isActive: boolean;
  completedAmount: number;
  completedCount: number;
  _count: { donations: number };
}

const FIELDS: FieldDef[] = [
  { key: "title", label: "Campaign title", type: "text", required: true },
  { key: "slug", label: "URL slug", type: "slug", from: "title" },
  { key: "goalAmount", label: "Goal amount (₹)", type: "number", hint: "Leave empty for an open-ended campaign." },
  { key: "isActive", label: "Accepting donations", type: "boolean", description: "Inactive campaigns are hidden from the donate page." },
  { key: "startDate", label: "Starts", type: "date" },
  { key: "endDate", label: "Ends", type: "date" },
  { key: "image", label: "Campaign image", type: "image", folder: "campaigns" },
  { key: "description", label: "Description", type: "textarea", markdown: true, rows: 8 },
];

const toValues = (c: CampaignRow): FormValues => ({ title: c.title, slug: c.slug, description: c.description ?? "", image: c.image ?? "", goalAmount: c.goalAmount ?? "", startDate: toDateInput(c.startDate), endDate: toDateInput(c.endDate), isActive: c.isActive });

export function CampaignManager({ items, canEdit }: { items: CampaignRow[]; canEdit: boolean }) {
  return (
    <EntityManager<CampaignRow>
      items={items}
      endpoint="/api/admin/donations/campaigns"
      itemLabel="campaign"
      itemName={(c) => c.title}
      canEdit={canEdit}
      fields={FIELDS}
      toValues={toValues}
      emptyValues={{ title: "", slug: "", description: "", image: "", goalAmount: "", startDate: "", endDate: "", isActive: true }}
      toolbar={`${items.length} campaign${items.length === 1 ? "" : "s"} · ${items.filter((c) => c.isActive).length} active`}
      columns={[
        {
          header: "Campaign",
          render: (c) => (
            <span className="block">
              <span className="block font-semibold text-ink">{c.title}</span>
              <span className="block font-mono text-xs text-muted">/{c.slug}</span>
            </span>
          ),
        },
        {
          header: "Raised",
          render: (c) => (
            <span className="block min-w-[12rem]">
              <span className="block text-sm font-semibold text-navy tabular-nums">
                {formatINR(c.raisedAmount)}
                {c.goalAmount ? <span className="font-normal text-muted"> of {formatINR(c.goalAmount)}</span> : null}
              </span>
              {c.goalAmount ? <ProgressBar value={c.raisedAmount} max={c.goalAmount} tone={c.raisedAmount >= c.goalAmount ? "success" : "orange"} className="mt-1" /> : <span className="text-xs text-muted">No goal set</span>}
            </span>
          ),
        },
        {
          header: "Donations",
          render: (c) => (
            <span className="block text-xs">
              <span className="block text-ink tabular-nums">{c.completedCount} completed</span>
              <span className="text-muted tabular-nums">{c._count.donations} total</span>
            </span>
          ),
        },
        {
          header: "Period",
          render: (c) => (
            <span className="block text-xs whitespace-nowrap text-muted">
              {c.startDate ? formatDate(c.startDate) : "—"} → {c.endDate ? formatDate(c.endDate) : "open"}
            </span>
          ),
        },
        { header: "Status", render: (c) => (c.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>) },
      ]}
      extraActions={(c) => (canEdit ? <QuickToggle endpoint={`/api/admin/donations/campaigns/${c.id}`} body={toValues(c)} field="isActive" onLabel="Activate" offLabel="Deactivate" /> : null)}
      deleteDescription={(c) => (c._count.donations > 0 ? `"${c.title}" has ${c._count.donations} donation${c._count.donations === 1 ? "" : "s"} recorded and cannot be deleted. Deactivate it instead.` : `"${c.title}" will be permanently removed. This cannot be undone.`)}
      emptyText="No campaigns yet. Create a campaign to collect donations for a specific cause."
    />
  );
}
