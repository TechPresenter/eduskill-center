"use client";

import { Eye, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { truncate } from "@/lib/utils";
import { EntityManager, type Segment } from "@/components/admin/content/entity-manager";
import { IconTile } from "@/components/admin/content/app-list";
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

  // Few options → chips instead of a select: visibility first, then each category.
  const segments: Segment<FaqRow>[] = [
    { value: "published", label: "Published", test: (f) => f.isPublished },
    { value: "hidden", label: "Hidden", test: (f) => !f.isPublished },
    ...categories.map((c) => ({ value: `cat:${c}`, label: c, test: (f: FaqRow) => f.category === c })),
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
      search={(f) => `${f.question} ${f.answer} ${f.category ?? ""}`}
      searchPlaceholder="Search questions and answers"
      segments={segments}
      emptyIcon={<HelpCircle className="h-7 w-7" />}
      emptyTitle="No FAQs yet"
      emptyText="Add the questions students and parents ask most. They appear on the website's FAQ page, grouped by category."
      row={(f) => ({
        leading: (
          <IconTile tone={f.isPublished ? "lavender" : "neutral"}>
            <HelpCircle />
          </IconTile>
        ),
        title: f.question,
        subtitle: truncate(f.answer, 140),
        meta: (
          <>
            {f.category && <Badge tone="navy">{f.category}</Badge>}
            {f.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Hidden</Badge>}
          </>
        ),
      })}
      columns={[
        {
          header: "Question",
          render: (f) => (
            <span className="block max-w-xl">
              <span className="block font-semibold text-ink">{f.question}</span>
              <span className="mt-0.5 block text-body-sm text-muted">{truncate(f.answer, 160)}</span>
            </span>
          ),
        },
        { header: "Category", render: (f) => (f.category ? <Badge tone="navy">{f.category}</Badge> : <span className="text-caption text-muted">—</span>) },
        { header: "Visibility", render: (f) => (f.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Hidden</Badge>) },
      ]}
      toggles={[
        {
          field: "isPublished",
          onLabel: "Publish",
          offLabel: "Unpublish",
          icon: <Eye className="h-5 w-5" />,
          disabled: !canPublish,
          title: "Requires the Publish permission",
        },
      ]}
    />
  );
}
