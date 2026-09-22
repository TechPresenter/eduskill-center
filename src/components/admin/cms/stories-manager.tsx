"use client";

import { Eye, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { withBasePath } from "@/lib/base-path";
import { truncate } from "@/lib/utils";
import { EntityManager } from "@/components/admin/content/entity-manager";
import type { FieldDef, FormValues } from "@/components/admin/content/fields";

export interface StoryRow {
  id: string;
  studentName: string;
  photoUrl: string | null;
  courseId: string | null;
  courseName: string | null;
  centerId: string | null;
  centerName: string | null;
  location: string | null;
  story: string;
  achievement: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  course: { id: string; name: string } | null;
  center: { id: string; name: string; code: string } | null;
}

interface Option {
  id: string;
  name: string;
  code?: string;
}

const toValues = (s: StoryRow): FormValues => ({
  studentName: s.studentName,
  photoUrl: s.photoUrl ?? "",
  courseId: s.courseId ?? "",
  courseName: s.courseName ?? "",
  centerId: s.centerId ?? "",
  centerName: s.centerName ?? "",
  location: s.location ?? "",
  story: s.story,
  achievement: s.achievement ?? "",
  isPublished: s.isPublished,
  isFeatured: s.isFeatured,
  sortOrder: s.sortOrder,
});

export function StoriesManager({ items, courses, centers, canEdit, canPublish }: { items: StoryRow[]; courses: Option[]; centers: Option[]; canEdit: boolean; canPublish: boolean }) {
  const fields: FieldDef[] = [
    { key: "studentName", label: "Student name", type: "text", required: true },
    { key: "location", label: "Location", type: "text", placeholder: "e.g. Varanasi, Uttar Pradesh" },
    { key: "photoUrl", label: "Photo", type: "image", folder: "stories" },
    { key: "courseId", label: "Course", type: "select", options: courses.map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name })), placeholder: "Not linked to a course" },
    { key: "courseName", label: "Course name (display)", type: "text", hint: "Filled from the course when left empty." },
    { key: "centerId", label: "Training center", type: "select", options: centers.map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name })), placeholder: "Not linked to a center" },
    { key: "centerName", label: "Center name (display)", type: "text", hint: "Filled from the center when left empty." },
    { key: "achievement", label: "Achievement", type: "text", span: 2, placeholder: "e.g. Placed as a data-entry operator" },
    { key: "story", label: "Story", type: "textarea", rows: 6, required: true },
    { key: "sortOrder", label: "Order", type: "number", hint: "Lower numbers appear first." },
    { key: "isFeatured", label: "Featured on the homepage", type: "boolean" },
    { key: "isPublished", label: "Published on the website", type: "boolean", disabled: !canPublish, description: canPublish ? undefined : "Requires the Publish permission" },
  ];

  return (
    <EntityManager<StoryRow>
      items={items}
      endpoint="/api/admin/cms/stories"
      itemLabel="story"
      itemName={(s) => s.studentName}
      canEdit={canEdit}
      fields={fields}
      toValues={toValues}
      emptyValues={{ studentName: "", photoUrl: "", courseId: "", courseName: "", centerId: "", centerName: "", location: "", story: "", achievement: "", isPublished: false, isFeatured: false, sortOrder: 0 }}
      addLabel="Add success story"
      itemLabelPlural="stories"
      search={(s) => `${s.studentName} ${s.location ?? ""} ${s.achievement ?? ""} ${s.course?.name ?? s.courseName ?? ""} ${s.center?.name ?? s.centerName ?? ""}`}
      searchPlaceholder="Search by student, course or center"
      segments={[
        { value: "published", label: "Published", test: (s) => s.isPublished },
        { value: "draft", label: "Draft", test: (s) => !s.isPublished },
        { value: "featured", label: "Featured", test: (s) => s.isFeatured },
      ]}
      emptyIcon={<Star className="h-7 w-7" />}
      emptyTitle="No success stories yet"
      row={(s) => ({
        leading: <Avatar name={s.studentName} src={s.photoUrl ? withBasePath(s.photoUrl) : null} size={44} />,
        title: s.studentName,
        subtitle: s.achievement ?? truncate(s.story, 100),
        meta: (
          <>
            {s.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
            {s.isFeatured && <Badge tone="orange">Featured</Badge>}
          </>
        ),
      })}
      toolbar={`${items.length} stor${items.length === 1 ? "y" : "ies"} · ${items.filter((s) => s.isPublished).length} published · ${items.filter((s) => s.isFeatured).length} featured`}
      columns={[
        {
          header: "Student",
          render: (s) => (
            <span className="flex items-center gap-3">
              <Avatar name={s.studentName} src={s.photoUrl ? withBasePath(s.photoUrl) : null} size={36} />
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{s.studentName}</span>
                <span className="block text-caption text-muted">{s.location ?? "—"}</span>
              </span>
            </span>
          ),
        },
        {
          header: "Course / center",
          render: (s) => (
            <span className="block text-body-sm">
              <span className="block text-ink">{s.course?.name ?? s.courseName ?? "—"}</span>
              <span className="text-muted">{s.center?.name ?? s.centerName ?? "—"}</span>
            </span>
          ),
        },
        { header: "Story", render: (s) => <span className="block max-w-md text-body-sm text-muted">{s.achievement ? <span className="block font-medium text-ink">{s.achievement}</span> : null}{truncate(s.story, 120)}</span> },
        {
          header: "Visibility",
          render: (s) => (
            <span className="flex flex-wrap gap-1">
              {s.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
              {s.isFeatured && <Badge tone="orange">Featured</Badge>}
            </span>
          ),
        },
        { header: "Order", render: (s) => <span className="tabular-nums">{s.sortOrder}</span>, className: "text-center" },
      ]}
      toggles={[
        { field: "isPublished", onLabel: "Publish", offLabel: "Unpublish", icon: <Eye className="h-5 w-5" />, disabled: !canPublish, title: "Requires the Publish permission" },
        { field: "isFeatured", onLabel: "Feature", offLabel: "Unfeature", icon: <Star className="h-5 w-5" /> },
      ]}
      emptyText="Add stories of students who completed training. Featured stories appear on the homepage."
    />
  );
}
