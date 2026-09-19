"use client";

import { Badge } from "@/components/ui/badge";
import { truncate } from "@/lib/utils";
import { EntityManager } from "@/components/admin/content/entity-manager";
import { QuickToggle } from "@/components/admin/content/toggle-action";
import type { FieldDef, FormValues } from "@/components/admin/content/fields";

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
}

const toValues = (f: FaqRow): FormValues => ({ question: f.question, answer: f.answer, category: f.category ?? "", sortOrder: f.sortOrder, isPublished: f.isPublished });

export function FaqManager({ items, categories, canEdit, canPublish }: { items: FaqRow[]; categories: string[]; canEdit: boolean; canPublish: boolean }) {
  const fields: FieldDef[] = [
    { key: "question", label: "Question", type: "text", required: true, span: 2 },
    { key: "answer", label: "Answer", type: "textarea", rows: 5, required: true },
    { key: "category", label: "Category", type: "text", placeholder: "e.g. Admissions", hint: categories.length ? `Existing: ${categories.join(", ")}` : "Groups questions on the FAQ page." },
    { key: "isPublished", label: "Published on the website", type: "boolean", disabled: !canPublish, description: canPublish ? undefined : "Requires the Publish permission" },
  ];

  return (
    <EntityManager<FaqRow>
      items={items}
      endpoint="/api/admin/faqs"
      itemLabel="FAQ"
      itemName={(f) => f.question}
      canEdit={canEdit}
      reorder
      fields={fields}
      toValues={toValues}
      emptyValues={{ question: "", answer: "", category: "", sortOrder: 0, isPublished: canPublish }}
      toolbar={`${items.length} question${items.length === 1 ? "" : "s"} · ${items.filter((f) => f.isPublished).length} published${categories.length ? ` · ${categories.length} categor${categories.length === 1 ? "y" : "ies"}` : ""}`}
      columns={[
        {
          header: "Question",
          render: (f) => (
            <span className="block max-w-xl">
              <span className="block font-semibold text-ink">{f.question}</span>
              <span className="block text-xs text-muted">{truncate(f.answer, 160)}</span>
            </span>
          ),
        },
        { header: "Category", render: (f) => (f.category ? <Badge tone="navy">{f.category}</Badge> : <span className="text-xs text-muted">—</span>) },
        { header: "Visibility", render: (f) => (f.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Hidden</Badge>) },
      ]}
      extraActions={(f) => (canEdit ? <QuickToggle endpoint={`/api/admin/faqs/${f.id}`} body={toValues(f)} field="isPublished" onLabel="Publish" offLabel="Unpublish" disabled={!canPublish} title={canPublish ? undefined : "Requires the Publish permission"} /> : null)}
      emptyText="No FAQs yet. Add the questions students and parents ask most."
    />
  );
}
