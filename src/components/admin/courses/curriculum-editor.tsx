"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, FileText, Film, ListTree, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/file-upload";
import { Fab } from "@/components/ui/fab";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { cn, titleCase } from "@/lib/utils";
import type { CourseNodeKind } from "@/generated/prisma/enums";
import type { CourseNodeTreeItem } from "@/server/course-cms";
import { DragHandle, ReorderButtons, SortInstructions, SortStatus, sortableRowClasses, useSortable } from "@/components/admin/courses/sortable";

/**
 * The recursive CourseNode editor: add, edit, delete and reorder MODULE → CHAPTER → TOPIC → LESSON
 * at any depth.
 *
 * Ordering is per level. Each level mounts its own `useSortable`, and a move posts the COMPLETE id
 * list for that level to `reorderCourseNodes(courseId, parentId, ids)` — one request, one
 * transaction, dense 1..n positions. Drag and keyboard both end in that same call.
 */

const KINDS = ["MODULE", "CHAPTER", "TOPIC", "LESSON"] as const;
/** Depth rank, mirroring `NODE_RANK` in src/server/course-cms.ts: a child must sit strictly deeper. */
const RANK: Record<CourseNodeKind, number> = { MODULE: 0, CHAPTER: 1, TOPIC: 2, LESSON: 3 };

const KIND_TONE: Record<CourseNodeKind, "navy" | "info" | "neutral" | "orange"> = { MODULE: "navy", CHAPTER: "info", TOPIC: "neutral", LESSON: "orange" };

interface NodeForm {
  parentId: string;
  kind: CourseNodeKind;
  title: string;
  description: string;
  videoUrl: string;
  documentUrl: string;
  studyMaterialUrl: string;
  durationText: string;
  durationMinutes: string;
  isFreePreview: boolean;
  isActive: boolean;
}

const emptyForm = (parentId: string, kind: CourseNodeKind): NodeForm => ({
  parentId,
  kind,
  title: "",
  description: "",
  videoUrl: "",
  documentUrl: "",
  studyMaterialUrl: "",
  durationText: "",
  durationMinutes: "",
  isFreePreview: false,
  isActive: true,
});

const toForm = (n: CourseNodeTreeItem): NodeForm => ({
  parentId: n.parentId ?? "",
  kind: n.kind,
  title: n.title,
  description: n.description ?? "",
  videoUrl: n.videoUrl ?? "",
  documentUrl: n.documentUrl ?? "",
  studyMaterialUrl: n.studyMaterialUrl ?? "",
  durationText: n.durationText ?? "",
  durationMinutes: n.durationMinutes == null ? "" : String(n.durationMinutes),
  isFreePreview: n.isFreePreview,
  isActive: n.isActive,
});

/** Flat index of the whole tree, so a parent can be found without walking it again each time. */
interface FlatNode {
  node: CourseNodeTreeItem;
  depth: number;
  parent: CourseNodeTreeItem | null;
}
function flatten(tree: CourseNodeTreeItem[], depth = 0, parent: CourseNodeTreeItem | null = null, out: FlatNode[] = []): FlatNode[] {
  for (const node of tree) {
    out.push({ node, depth, parent });
    flatten(node.children, depth + 1, node, out);
  }
  return out;
}

function descendantIds(node: CourseNodeTreeItem, out: Set<string> = new Set()): Set<string> {
  for (const c of node.children) {
    out.add(c.id);
    descendantIds(c, out);
  }
  return out;
}

/** Kinds that may sit inside a parent of this kind. A LESSON is a leaf; a root may be anything. */
function kindsUnder(parentKind: CourseNodeKind | null): CourseNodeKind[] {
  if (!parentKind) return [...KINDS];
  if (parentKind === "LESSON") return [];
  return KINDS.filter((k) => RANK[k] > RANK[parentKind]);
}

function countLeaves(nodes: CourseNodeTreeItem[]): { items: number; lessons: number } {
  let items = 0;
  let lessons = 0;
  const walk = (list: CourseNodeTreeItem[]) => {
    for (const n of list) {
      items += 1;
      if (n.kind === "LESSON") lessons += 1;
      walk(n.children);
    }
  };
  walk(nodes);
  return { items, lessons };
}

/* ───────────────────────────── Lesson media field ───────────────────────────── */

/**
 * A lesson's video / document / study material: an external link typed in, or a file uploaded
 * through `/api/admin/uploads` (which is `src/lib/storage`). Never inline data — the service
 * refuses a `data:` URL outright.
 */
function MediaLinkField({ label, hint, value, onChange, error, disabled, preset, accept, folder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string; disabled?: boolean; preset: "image" | "material"; accept: string; folder: string }) {
  const stored = value.startsWith("/api/files/") || value.startsWith("/center/api/files/");
  // `Field` can only auto-wire a label to a SINGLE control child, and this one is a URL box plus an
  // uploader — so the id is passed explicitly, or the label would point at nothing.
  const id = React.useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="space-y-2">
        {/* Field names its hint/error nodes after the control id, so they can be referenced by hand. */}
        <Input
          id={id}
          aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload below"
          disabled={disabled}
          inputMode="url"
        />
        {value ? (
          <div className="flex flex-wrap items-center gap-2">
            <a href={withBasePath(value)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-orange hover:underline">
              {stored ? "Open the uploaded file" : "Open the link"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange("")} disabled={disabled}>
              Clear
            </Button>
          </div>
        ) : (
          <FileUpload endpoint="/api/admin/uploads" fields={{ preset, folder, visibility: "public" }} accept={accept} maxSizeMb={preset === "material" ? 50 : 5} value={null} disabled={disabled} label={`Upload ${label.toLowerCase()}`} onChange={(f) => onChange(f?.url ?? "")} />
        )}
      </div>
    </Field>
  );
}

/* ───────────────────────────── One ordered level ───────────────────────────── */

interface LevelProps {
  courseId: string;
  nodes: CourseNodeTreeItem[];
  parentId: string | null;
  depth: number;
  canEdit: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parent: CourseNodeTreeItem) => void;
  onEdit: (node: CourseNodeTreeItem) => void;
  onDelete: (node: CourseNodeTreeItem) => void;
}

function Level({ courseId, nodes, parentId, depth, canEdit, collapsed, onToggle, onAddChild, onEdit, onDelete }: LevelProps) {
  const router = useRouter();
  const ids = React.useMemo(() => nodes.map((n) => n.id), [nodes]);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const labelOf = React.useCallback((id: string) => byId.get(id)?.title ?? "Item", [byId]);

  const onCommit = React.useCallback(
    async (next: string[]) => {
      try {
        await api.post(`/api/admin/courses/${courseId}/curriculum/reorder`, { parentId: parentId ?? "", ids: next });
        router.refresh();
      } catch (err) {
        toast.error("Could not save the new order", errorMessage(err));
        throw err;
      }
    },
    [courseId, parentId, router]
  );

  const sortable = useSortable({ ids, labelOf, onCommit, disabled: !canEdit });
  const ordered = sortable.order.map((id) => byId.get(id)).filter((n): n is CourseNodeTreeItem => !!n);

  return (
    <>
      <SortInstructions id={sortable.instructionsId} itemLabel="curriculum item" />
      <SortStatus message={sortable.message} />
      <ul className={cn("space-y-1", depth > 0 && "mt-1 ml-3 border-l border-line pl-1 sm:ml-4 sm:pl-2")}>
        {ordered.map((node) => {
          const open = !collapsed.has(node.id);
          const hasChildren = node.children.length > 0;
          const canHoldChildren = node.kind !== "LESSON";
          const totals = countLeaves(node.children);

          const actions = (
            <>
              {canEdit && <ReorderButtons sortable={sortable} id={node.id} what={node.title} />}
              {canEdit && canHoldChildren && <IconButton size="sm" icon={<Plus className="h-4 w-4" />} aria-label={`Add an item inside ${node.title}`} onClick={() => onAddChild(node)} />}
              {canEdit && <IconButton size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`Edit ${node.title}`} onClick={() => onEdit(node)} />}
              {canEdit && <IconButton size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Delete ${node.title}`} onClick={() => onDelete(node)} className="hover:bg-danger-light hover:text-danger" />}
            </>
          );

          return (
            <li key={node.id}>
              <div {...sortable.rowProps(node.id)} className={cn("flex items-start gap-1 rounded-md border border-line bg-white pr-1.5", sortableRowClasses(sortable, node.id), sortable.saving && "opacity-70")}>
                {canEdit && <DragHandle sortable={sortable} id={node.id} />}
                {hasChildren ? (
                  <button type="button" onClick={() => onToggle(node.id)} aria-expanded={open} className="ring-focus tap-highlight-none inline-flex h-11 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:text-ink">
                    {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                    <span className="sr-only">{open ? `Collapse ${node.title}` : `Expand ${node.title}`}</span>
                  </button>
                ) : (
                  <span className="h-11 w-8 shrink-0" aria-hidden />
                )}

                <div className="min-w-0 flex-1 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge tone={KIND_TONE[node.kind]}>{titleCase(node.kind)}</Badge>
                    <span className="min-w-0 font-semibold text-navy">{node.title}</span>
                    {!node.isActive && <Badge tone="neutral">Hidden</Badge>}
                    {node.isFreePreview && <Badge tone="success">Preview</Badge>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted">
                    {node.durationText && <span>{node.durationText}</span>}
                    {node.durationMinutes != null && <span className="tabular-nums">{node.durationMinutes} min</span>}
                    {hasChildren && (
                      <span className="tabular-nums">
                        {totals.items} inside{totals.lessons > 0 ? ` · ${totals.lessons} lesson${totals.lessons === 1 ? "" : "s"}` : ""}
                      </span>
                    )}
                    {node.videoUrl && (
                      <span className="inline-flex items-center gap-1">
                        <Film className="h-3.5 w-3.5" aria-hidden /> Video
                      </span>
                    )}
                    {node.documentUrl && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" aria-hidden /> Document
                      </span>
                    )}
                    {node.studyMaterialUrl && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" aria-hidden /> Material
                      </span>
                    )}
                    {!node.durationText && node.durationMinutes == null && !hasChildren && !node.videoUrl && !node.documentUrl && !node.studyMaterialUrl && <span>&mdash;</span>}
                  </p>
                  {/* Phones: the action cluster gets its own line so nothing is squeezed at 360px. */}
                  <div className="mt-1 flex flex-wrap items-center gap-0.5 sm:hidden">{actions}</div>
                </div>

                <div className="hidden shrink-0 items-center gap-0.5 py-1.5 sm:flex">{actions}</div>
              </div>

              {hasChildren && open && (
                <Level courseId={courseId} nodes={node.children} parentId={node.id} depth={depth + 1} canEdit={canEdit} collapsed={collapsed} onToggle={onToggle} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ───────────────────────────── The editor ───────────────────────────── */

type Editing = { mode: "new"; parent: CourseNodeTreeItem | null } | { mode: "edit"; node: CourseNodeTreeItem } | null;

export function CurriculumEditor({ courseId, tree, canEdit }: { courseId: string; tree: CourseNodeTreeItem[]; canEdit: boolean }) {
  const router = useRouter();
  const formId = React.useId();
  const [editing, setEditing] = React.useState<Editing>(null);
  const [values, setValues] = React.useState<NodeForm>(emptyForm("", "MODULE"));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CourseNodeTreeItem | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const flat = React.useMemo(() => flatten(tree), [tree]);
  const totals = React.useMemo(() => countLeaves(tree), [tree]);

  const set = <K extends keyof NodeForm>(k: K, v: NodeForm[K]) => setValues((cur) => ({ ...cur, [k]: v }));

  const open = (next: Exclude<Editing, null>) => {
    if (next.mode === "new") {
      const allowed = kindsUnder(next.parent?.kind ?? null);
      setValues(emptyForm(next.parent?.id ?? "", allowed[0] ?? "MODULE"));
    } else {
      setValues(toForm(next.node));
    }
    setErrors({});
    setFormError(null);
    setEditing(next);
  };

  /** Parents this node may be moved under: not itself, not its own descendants, not a lesson, and shallower than the chosen kind. */
  const parentChoices = React.useMemo(() => {
    if (!editing) return [];
    const blocked = editing.mode === "edit" ? new Set([editing.node.id, ...descendantIds(editing.node)]) : new Set<string>();
    return flat
      .filter(({ node }) => !blocked.has(node.id) && node.kind !== "LESSON" && RANK[node.kind] < RANK[values.kind])
      .map(({ node, depth }) => ({ value: node.id, label: `${"— ".repeat(depth)}${node.title} (${titleCase(node.kind)})` }));
  }, [editing, flat, values.kind]);

  const parentKind = React.useMemo(() => flat.find(({ node }) => node.id === values.parentId)?.node.kind ?? null, [flat, values.parentId]);
  const kindChoices = React.useMemo(() => {
    const allowed = kindsUnder(parentKind);
    // Keep the current value selectable even when the parent makes it invalid, so the field shows
    // the real state and the server's message explains the clash rather than a silent swap.
    return (allowed.includes(values.kind) ? allowed : [values.kind, ...allowed]).map((k) => ({ value: k, label: titleCase(k) }));
  }, [parentKind, values.kind]);

  const isLesson = values.kind === "LESSON";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    const payload = {
      parentId: values.parentId,
      kind: values.kind,
      title: values.title,
      description: values.description,
      videoUrl: isLesson ? values.videoUrl : "",
      documentUrl: isLesson ? values.documentUrl : "",
      studyMaterialUrl: isLesson ? values.studyMaterialUrl : "",
      durationText: values.durationText,
      durationMinutes: values.durationMinutes,
      isFreePreview: isLesson && values.isFreePreview,
      isActive: values.isActive,
    };
    try {
      if (editing.mode === "new") await api.post(`/api/admin/courses/${courseId}/curriculum`, payload);
      else await api.put(`/api/admin/courses/${courseId}/curriculum/${editing.node.id}`, payload);
      toast.success(editing.mode === "new" ? `${titleCase(values.kind)} added` : "Curriculum item updated");
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      const res = await api.delete<{ removed: number }>(`/api/admin/courses/${courseId}/curriculum/${deleting.id}`);
      toast.success(res.removed > 1 ? `Removed "${deleting.title}" and ${res.removed - 1} item(s) inside it` : `Removed "${deleting.title}"`);
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete", errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const toggle = (id: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const branchIds = flat.filter(({ node }) => node.children.length > 0).map(({ node }) => node.id);
  const deletingInside = deleting ? countLeaves(deleting.children).items : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Curriculum"
          description={totals.items === 0 ? "Build the course outline: modules, chapters, topics and lessons, nested as deeply as you need." : `${totals.items} item${totals.items === 1 ? "" : "s"} · ${totals.lessons} lesson${totals.lessons === 1 ? "" : "s"}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {branchIds.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setCollapsed((cur) => (cur.size ? new Set() : new Set(branchIds)))}>
                  {collapsed.size ? "Expand all" : "Collapse all"}
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => open({ mode: "new", parent: null })} leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
                  Add top-level item
                </Button>
              )}
            </div>
          }
        />
        <CardBody>
          {tree.length === 0 ? (
            <EmptyState
              icon={<ListTree className="h-7 w-7" />}
              title="No curriculum yet"
              description="Start with a module, then add chapters, topics and lessons inside it. Lessons carry the video, the document, the study material and the preview flag."
              action={
                canEdit ? (
                  <Button onClick={() => open({ mode: "new", parent: null })} leftIcon={<Plus className="h-4 w-4" />}>
                    Add the first module
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {canEdit && <p className="mb-3 text-caption text-muted">Drag the handle to reorder inside a level, or focus a handle and use the arrow keys. Move up and Move down do the same thing.</p>}
              <Level courseId={courseId} nodes={tree} parentId={null} depth={0} canEdit={canEdit} collapsed={collapsed} onToggle={toggle} onAddChild={(parent) => open({ mode: "new", parent })} onEdit={(node) => open({ mode: "edit", node })} onDelete={setDeleting} />
            </>
          )}
        </CardBody>
      </Card>

      {canEdit && <Fab aria-label="Add top-level item" icon={<Plus className="h-6 w-6" aria-hidden />} onClick={() => open({ mode: "new", parent: null })} />}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        size="xl"
        title={editing?.mode === "new" ? (editing.parent ? `Add inside "${editing.parent.title}"` : "Add a top-level item") : "Edit curriculum item"}
        description={editing?.mode === "edit" ? editing.node.title : undefined}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {editing?.mode === "new" ? "Add item" : "Save changes"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormGrid>
            <Field label="Sits inside" hint="Choose where this item belongs. Top level items are the course outline." error={errors.parentId}>
              <Select value={values.parentId} onChange={(e) => set("parentId", e.target.value)} disabled={saving} options={[{ value: "", label: "Top level (course outline)" }, ...parentChoices]} />
            </Field>
            <Field label="Type" required error={errors.kind} hint={parentKind ? `Inside a ${parentKind.toLowerCase()} this must sit deeper.` : "A lesson is always a leaf."}>
              <Select value={values.kind} onChange={(e) => set("kind", e.target.value as CourseNodeKind)} disabled={saving} options={kindChoices} />
            </Field>
          </FormGrid>

          <Field label="Title" required error={errors.title}>
            <Input value={values.title} onChange={(e) => set("title", e.target.value)} disabled={saving} maxLength={200} placeholder="e.g. Introduction to spreadsheets" />
          </Field>

          <Field label="Description" error={errors.description} hint="Shown under the title on the public curriculum.">
            <Textarea value={values.description} onChange={(e) => set("description", e.target.value)} rows={3} disabled={saving} maxLength={5000} />
          </Field>

          <FormGrid>
            <Field label="Duration label" error={errors.durationText} hint="Free text, e.g. 45 minutes or 2 sessions.">
              <Input value={values.durationText} onChange={(e) => set("durationText", e.target.value)} disabled={saving} maxLength={60} />
            </Field>
            <Field label="Duration in minutes" error={errors.durationMinutes} hint="Used to total up the course length.">
              <Input value={values.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value.replace(/[^0-9]/g, ""))} disabled={saving} inputMode="numeric" />
            </Field>
          </FormGrid>

          {isLesson && (
            <div className="space-y-4 rounded-card border border-line bg-surface p-4">
              <p className="text-caption font-semibold tracking-wide text-muted uppercase">Lesson content</p>
              <MediaLinkField label="Video" hint="A YouTube or Vimeo link, or upload an MP4." value={values.videoUrl} onChange={(v) => set("videoUrl", v)} error={errors.videoUrl} disabled={saving} preset="material" accept=".mp4" folder={`courses/${courseId}/lessons`} />
              <MediaLinkField label="Document" hint="The handout for this lesson." value={values.documentUrl} onChange={(v) => set("documentUrl", v)} error={errors.documentUrl} disabled={saving} preset="material" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" folder={`courses/${courseId}/lessons`} />
              <MediaLinkField label="Study material" hint="Workbook, dataset or exercise pack." value={values.studyMaterialUrl} onChange={(v) => set("studyMaterialUrl", v)} error={errors.studyMaterialUrl} disabled={saving} preset="material" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" folder={`courses/${courseId}/lessons`} />
              <Checkbox checked={values.isFreePreview} onChange={(e) => set("isFreePreview", e.target.checked)} disabled={saving} label="Preview lesson" description="Visitors can open this lesson without enrolling." />
            </div>
          )}

          <Checkbox checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} disabled={saving} label="Show on the website" description="Turn this off to keep the item while you finish writing it." />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this curriculum item?"
        description={deleting ? (deletingInside > 0 ? `"${deleting.title}" and the ${deletingInside} item(s) inside it will be removed from the course.` : `"${deleting.title}" will be removed from the course.`) : null}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </div>
  );
}
