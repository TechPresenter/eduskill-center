"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, MoreVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button, IconButton, iconButtonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet";
import { SegmentedControl } from "@/components/ui/tabs";
import { Fab } from "@/components/ui/fab";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { FormFields, finalizeSlugs, type FieldDef, type FormValues } from "@/components/admin/content/fields";
import { AppList, AppListRow, SaveStatus } from "@/components/admin/content/app-list";

export interface Column<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  /**
   * Card-mode role below `md` when no `row` view is given: "full" = the card title row (defaults to the
   * first column), "hidden" drops the cell on phones. Other cells show the column header as their label.
   */
  mobile?: "full" | "hidden";
  /** Overrides the card-mode label (defaults to `header`). */
  label?: string;
}

/** The phone presentation of one record: an app list row. */
export interface RowView {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}

/** A one-tap boolean flip (publish / feature / show). The API validates the whole record, so the item's form values are sent with `field` inverted. */
export interface ToggleDef<T> {
  field: string;
  /** Label of the action that turns the flag ON ("Publish"). */
  onLabel: string;
  /** Label of the action that turns the flag OFF ("Unpublish"). */
  offLabel: string;
  icon?: React.ReactNode;
  disabled?: boolean | ((item: T) => boolean);
  /** Why it is disabled (tooltip on desktop, secondary line in the phone sheet). */
  title?: string;
}

export interface Segment<T> {
  value: string;
  label: string;
  test: (item: T) => boolean;
}

export interface EntityManagerProps<T extends { id: string }> {
  items: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  /** POST here; PUT/DELETE at `${endpoint}/${id}`; reorder POST at `${endpoint}/reorder`. */
  endpoint: string;
  toValues: (item: T) => FormValues;
  emptyValues: FormValues;
  /** Singular noun, e.g. "program". */
  itemLabel: string;
  /** Plural noun when it is not `${itemLabel}s` (e.g. "stories"). */
  itemLabelPlural?: string;
  itemName?: (item: T) => string;
  canEdit: boolean;
  canDelete?: boolean;
  reorder?: boolean;
  modalSize?: "md" | "lg" | "xl";
  addLabel?: string;
  /** Extra desktop/phone controls rendered next to the built-in actions (prefer `toggles` / `links`). */
  extraActions?: (item: T) => React.ReactNode;
  toggles?: ToggleDef<T>[];
  /** Public pages for a record ("View on website"). App-absolute paths get the deployment base path. */
  links?: (item: T) => { href: string; label: string }[];
  deleteDescription?: (item: T) => React.ReactNode;
  emptyText?: string;
  emptyTitle?: string;
  emptyIcon?: React.ReactNode;
  /** Summary line above the list (e.g. counts). */
  toolbar?: React.ReactNode;
  /** Phone row. When set, phones get an app list and `md`+ keeps the table. */
  row?: (item: T) => RowView;
  /** Enables the in-page search box; return the text a record is searched by. */
  search?: (item: T) => string;
  searchPlaceholder?: string;
  /** Filter chips above the list ("All" is added automatically). */
  segments?: Segment<T>[];
  className?: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const same = (a: FormValues, b: FormValues) => JSON.stringify(a) === JSON.stringify(b);

/**
 * List + editor for small, fully-loaded collections (FAQs, programs, stories, partners, campaigns).
 *
 * Phones get an app list: 64px rows, tap to edit, a "⋮" button that opens an action sheet (edit,
 * publish, reorder, view, delete) and a floating "Add" button. From `md` the same records render as a
 * table with inline actions. The editor is a sheet on phones and a dialog on desktop, with a save state
 * in its footer and a discard confirmation when closed with unsaved changes.
 */
export function EntityManager<T extends { id: string }>({
  items,
  columns,
  fields,
  endpoint,
  toValues,
  emptyValues,
  itemLabel,
  itemLabelPlural,
  itemName,
  canEdit,
  canDelete = canEdit,
  reorder,
  modalSize = "lg",
  addLabel,
  extraActions,
  toggles = [],
  links,
  deleteDescription,
  emptyText,
  emptyTitle,
  emptyIcon,
  toolbar,
  row,
  search,
  searchPlaceholder,
  segments,
  className,
}: EntityManagerProps<T>) {
  const router = useRouter();
  const plural = itemLabelPlural ?? `${itemLabel}s`;
  const formId = React.useId();
  const [editing, setEditing] = React.useState<T | null | "new">(null);
  const [initial, setInitial] = React.useState<FormValues>(emptyValues);
  const [values, setValues] = React.useState<FormValues>(emptyValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [deleting, setDeleting] = React.useState<T | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [sheetFor, setSheetFor] = React.useState<T | null>(null);
  const [query, setQuery] = React.useState("");
  const [segment, setSegment] = React.useState("all");

  const dirty = editing !== null && !same(values, initial);
  const nameOf = (item: T) => itemName?.(item) ?? itemLabel;

  /* ─── Filtering (client-side: these collections are loaded in full) ─── */
  const needle = query.trim().toLowerCase();
  const activeSegment = segments?.find((s) => s.value === segment);
  const visible = items.filter((it) => (!activeSegment || activeSegment.test(it)) && (!needle || !search || search(it).toLowerCase().includes(needle)));
  const filtering = visible.length !== items.length || !!needle || !!activeSegment;
  const canReorder = !!reorder && canEdit && !filtering;

  /* ─── Editor ─── */
  const open = (item: T | "new") => {
    const v = item === "new" ? emptyValues : toValues(item);
    setEditing(item);
    setInitial(v);
    setValues(v);
    setErrors({});
    setFormError(null);
  };
  const forceClose = () => {
    setConfirmDiscard(false);
    setEditing(null);
  };
  const close = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else setEditing(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = finalizeSlugs(fields, values);
      if (editing === "new") await api.post(endpoint, payload);
      else await api.put(`${endpoint}/${editing.id}`, payload);
      toast.success(editing === "new" ? `${cap(itemLabel)} created` : `${cap(itemLabel)} updated`);
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

  /* ─── Row actions ─── */
  const remove = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.delete(`${endpoint}/${deleting.id}`);
      toast.success(`${cap(itemLabel)} deleted`);
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (item: T, dir: -1 | 1) => {
    const index = items.findIndex((i) => i.id === item.id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusyId(item.id);
    try {
      await api.post(`${endpoint}/reorder`, { ids });
      router.refresh();
    } catch (err) {
      toast.error("Could not reorder", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const flip = async (item: T, t: ToggleDef<T>) => {
    const body = toValues(item);
    const current = !!body[t.field];
    setBusyId(item.id);
    try {
      await api.put(`${endpoint}/${item.id}`, { ...body, [t.field]: !current });
      toast.success(`${current ? t.offLabel : t.onLabel} · ${nameOf(item)}`);
      router.refresh();
    } catch (err) {
      toast.error("Could not update", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const toggleDisabled = (t: ToggleDef<T>, item: T) => (typeof t.disabled === "function" ? t.disabled(item) : !!t.disabled);
  const hasActions = canEdit || canDelete || !!reorder || !!extraActions || toggles.length > 0 || !!links;

  const sheetItems = (item: T): ActionSheetItem[] => {
    const index = items.findIndex((i) => i.id === item.id);
    const v = toValues(item);
    return [
      { label: `Edit ${itemLabel}`, icon: <Pencil className="h-5 w-5" />, onSelect: () => open(item), hidden: !canEdit },
      ...(canEdit
        ? toggles.map((t) => ({
            label: v[t.field] ? t.offLabel : t.onLabel,
            icon: t.icon,
            disabled: toggleDisabled(t, item),
            description: toggleDisabled(t, item) ? t.title : undefined,
            onSelect: () => void flip(item, t),
          }))
        : []),
      { label: "Move up", icon: <ArrowUp className="h-5 w-5" />, onSelect: () => void move(item, -1), hidden: !canReorder, disabled: index === 0 },
      { label: "Move down", icon: <ArrowDown className="h-5 w-5" />, onSelect: () => void move(item, 1), hidden: !canReorder, disabled: index === items.length - 1 },
      ...(links?.(item) ?? []).map((l) => ({ label: l.label, icon: <ExternalLink className="h-5 w-5" />, onSelect: () => window.open(withBasePath(l.href), "_blank", "noopener,noreferrer") })),
      { label: `Delete ${itemLabel}`, icon: <Trash2 className="h-5 w-5" />, danger: true, onSelect: () => setDeleting(item), hidden: !canDelete },
    ];
  };

  /* ─── Rendering ─── */
  const empty = (
    <EmptyState
      icon={emptyIcon}
      title={emptyTitle ?? `No ${plural} yet`}
      description={emptyText}
      action={
        canEdit ? (
          <Button onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />}>
            {addLabel ?? `Add ${itemLabel}`}
          </Button>
        ) : undefined
      }
    />
  );
  const noMatch = (
    <EmptyState
      size="sm"
      icon={<Search className="h-6 w-6" />}
      title={`No ${plural} match`}
      description="Try another search word or filter."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuery("");
            setSegment("all");
          }}
        >
          Clear filters
        </Button>
      }
    />
  );

  const desktopActions = (item: T) => {
    const v = toValues(item);
    const index = items.findIndex((i) => i.id === item.id);
    return (
      <div className="inline-flex items-center justify-end gap-1">
        {extraActions?.(item)}
        {canEdit &&
          toggles.map((t) => {
            const on = !!v[t.field];
            return (
              <Button key={t.field} size="sm" variant={on ? "ghost" : "outline"} onClick={() => void flip(item, t)} disabled={toggleDisabled(t, item) || busyId === item.id} title={toggleDisabled(t, item) ? t.title : undefined} aria-pressed={on}>
                {on ? t.offLabel : t.onLabel}
              </Button>
            );
          })}
        {(links?.(item) ?? []).map((l) => (
          <a key={l.href} href={withBasePath(l.href)} target="_blank" rel="noopener noreferrer" className={iconButtonClasses({ size: "sm" })} aria-label={`${l.label}: ${nameOf(item)}`} title={l.label}>
            <ExternalLink className="h-4 w-4" />
          </a>
        ))}
        {canReorder && (
          <>
            <IconButton size="sm" icon={<ArrowUp className="h-4 w-4" />} aria-label={`Move ${nameOf(item)} up`} onClick={() => void move(item, -1)} disabled={index === 0 || busyId === item.id} />
            <IconButton size="sm" icon={<ArrowDown className="h-4 w-4" />} aria-label={`Move ${nameOf(item)} down`} onClick={() => void move(item, 1)} disabled={index === items.length - 1 || busyId === item.id} />
          </>
        )}
        {canEdit && <IconButton size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`Edit ${nameOf(item)}`} onClick={() => open(item)} />}
        {canDelete && <IconButton size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Delete ${nameOf(item)}`} onClick={() => setDeleting(item)} className="hover:bg-danger-light hover:text-danger" />}
      </div>
    );
  };

  const table = (
    <TableWrap cards={!row}>
      <THead>
        <tr>
          {reorder && <TH className="md:w-10">#</TH>}
          {columns.map((c) => (
            <TH key={c.header} className={c.className}>
              {c.header}
            </TH>
          ))}
          {hasActions && <TH className="text-right">Actions</TH>}
        </tr>
      </THead>
      <TBody>
        {visible.length === 0 ? (
          <EmptyRow colSpan={columns.length + (reorder ? 1 : 0) + (hasActions ? 1 : 0)}>{items.length === 0 ? (emptyText ?? `No ${plural} yet.`) : `No ${plural} match these filters.`}</EmptyRow>
        ) : (
          visible.map((item) => (
            <TR key={item.id} className={cn(busyId === item.id && "opacity-60")}>
              {reorder && (
                <TD mobile="hidden" className="text-caption text-muted tabular-nums">
                  {items.findIndex((i) => i.id === item.id) + 1}
                </TD>
              )}
              {columns.map((c, ci) => (
                <TD key={c.header} label={c.label} mobile={c.mobile ?? (ci === 0 ? "full" : undefined)} className={c.className}>
                  {c.render(item)}
                </TD>
              ))}
              {hasActions && (
                <TD mobile="actions" className="text-right">
                  {desktopActions(item)}
                </TD>
              )}
            </TR>
          ))
        )}
      </TBody>
    </TableWrap>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar: summary + search + add (the add button becomes a FAB on phones). */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-muted tabular-nums" role="status" aria-atomic="true">
            {filtering ? `Showing ${visible.length} of ${items.length} ${items.length === 1 ? itemLabel : plural}` : (toolbar ?? `${items.length} ${items.length === 1 ? itemLabel : plural}`)}
          </p>
          <div className="flex items-center gap-2">
            {search && items.length > 0 && (
              <div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
                <Input
                  value={query}
                  inputMode="search"
                  enterKeyHint="search"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder ?? `Search ${plural}`}
                  aria-label={`Search ${plural}`}
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
            )}
            {canEdit && (
              <Button size="sm" onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
                {addLabel ?? `Add ${itemLabel}`}
              </Button>
            )}
          </div>
        </div>
        {segments && segments.length > 0 && items.length > 0 && (
          <SegmentedControl
            scrollable
            className="max-w-full"
            value={segment}
            onChange={setSegment}
            items={[{ value: "all", label: `All · ${items.length}` }, ...segments.map((s) => ({ value: s.value, label: `${s.label} · ${items.filter(s.test).length}` }))]}
          />
        )}
        {reorder && canEdit && filtering && items.length > 1 && <p className="text-caption text-muted">Clear the search and filters to change the order.</p>}
      </div>

      {items.length === 0 ? (
        empty
      ) : row ? (
        <>
          {/* Phones: app list. */}
          <div className="md:hidden">
            {visible.length === 0 ? (
              noMatch
            ) : (
              <AppList aria-label={cap(plural)}>
                {visible.map((item) => {
                  const r = row(item);
                  return (
                    <AppListRow
                      key={item.id}
                      className={cn(busyId === item.id && "opacity-60")}
                      leading={r.leading}
                      title={r.title}
                      subtitle={r.subtitle}
                      meta={r.meta}
                      trailing={r.trailing}
                      onClick={canEdit ? () => open(item) : undefined}
                      aria-label={canEdit ? `Edit ${nameOf(item)}` : undefined}
                      chevron={false}
                      actions={
                        hasActions ? (
                          <>
                            {extraActions?.(item)}
                            <IconButton icon={<MoreVertical className="h-5 w-5" />} aria-label={`Actions for ${nameOf(item)}`} onClick={() => setSheetFor(item)} />
                          </>
                        ) : undefined
                      }
                    />
                  );
                })}
              </AppList>
            )}
          </div>
          {/* md+: table. */}
          <div className="hidden md:block">{table}</div>
        </>
      ) : (
        table
      )}

      {canEdit && <Fab aria-label={addLabel ?? `Add ${itemLabel}`} icon={<Plus className="h-6 w-6" aria-hidden />} onClick={() => open("new")} />}

      <ActionSheet open={!!sheetFor} onClose={() => setSheetFor(null)} title={sheetFor ? nameOf(sheetFor) : undefined} items={sheetFor ? sheetItems(sheetFor) : []} />

      <Modal
        open={!!editing}
        onClose={close}
        title={editing === "new" ? (addLabel ?? `Add ${itemLabel}`) : `Edit ${itemLabel}`}
        description={editing && editing !== "new" ? nameOf(editing) : undefined}
        size={modalSize}
        footer={
          <>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving} disabled={editing !== "new" && !dirty}>
              {editing === "new" ? `Create ${itemLabel}` : "Save changes"}
            </Button>
            {/* Last in the DOM so the stacked phone footer shows it on top; first (left) from sm. */}
            <SaveStatus state={saving ? "saving" : formError ? "error" : dirty ? "dirty" : "clean"} idle={editing === "new" ? "New – not saved yet" : "No changes yet"} className="justify-center sm:order-first sm:mr-auto sm:justify-start" />
          </>
        }
      >
        <form id={formId} onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormFields fields={fields} values={values} onChange={setValues} errors={errors} disabled={saving} idPrefix={`em-${itemLabel.replace(/\s+/g, "-")}`} />
        </form>
      </Modal>

      <ConfirmDialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} onConfirm={forceClose} title="Discard your changes?" description={`The changes to this ${itemLabel} have not been saved.`} confirmLabel="Discard" cancelLabel="Keep editing" danger />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={`Delete ${itemLabel}?`}
        description={deleting ? (deleteDescription?.(deleting) ?? `"${nameOf(deleting)}" will be permanently removed. This cannot be undone.`) : null}
        confirmLabel="Delete"
        danger
        loading={!!busyId}
      />
    </div>
  );
}
