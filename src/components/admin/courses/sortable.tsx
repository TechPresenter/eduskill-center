"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Reordering for the Course CMS collections — pointer drag AND a full keyboard path, from one hook.
 *
 * Hand-rolled on purpose: the project stays dependency-light, and native HTML5 drag events plus a
 * "grabbed" state are enough. A mouse-only reorder UI is a defect, so every list offers three ways
 * to move a row:
 *
 *   1. drag the handle (pointer);
 *   2. focus the handle, press Space/Enter to pick up, Arrow Up/Down to move, Enter to drop,
 *      Escape to cancel;
 *   3. the plain Move up / Move down buttons (`ReorderButtons`), which save immediately.
 *
 * Every move is announced through one polite live region (`SortStatus`) — a silent reorder is
 * invisible to a screen reader.
 *
 * One hook instance owns exactly ONE ordered scope (a single tree level, one media kind, the FAQ
 * list). That is what the services require: `reorderCourseNodes` / `reorderCourseFaqs` /
 * `reorderCourseMedia` all demand the COMPLETE id list for the scope and renumber it 1..n in a
 * single transaction.
 */

export interface UseSortableOptions {
  /** The complete, ordered id list for this scope, as the server last returned it. */
  ids: string[];
  /** Human name of a row, used in the live-region announcements. */
  labelOf: (id: string) => string;
  /** Persists the whole new order (one request, one transaction). Must throw to signal failure. */
  onCommit: (ids: string[]) => Promise<void>;
  disabled?: boolean;
}

export interface Sortable {
  /** What to render: the optimistic order while dragging/grabbed/saving, otherwise the server order. */
  order: string[];
  saving: boolean;
  grabbedId: string | null;
  draggingId: string | null;
  overId: string | null;
  /** Feed this to `<SortInstructions id=…>`; the handles point at it with `aria-describedby`. */
  instructionsId: string;
  message: string;
  indexOf: (id: string) => number;
  count: number;
  canSort: boolean;
  moveBy: (id: string, delta: -1 | 1) => void;
  handleProps: (id: string) => React.ComponentProps<"button">;
  rowProps: (id: string) => React.ComponentProps<"div">;
}

function moved(list: string[], from: number, to: number): string[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function useSortable({ ids, labelOf, onCommit, disabled }: UseSortableOptions): Sortable {
  const instructionsId = React.useId();
  const key = ids.join(",");
  const [override, setOverride] = React.useState<string[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [grabbedId, setGrabbedId] = React.useState<string | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  /** The order as it was when the current drag or keyboard grab began, so Escape can undo it. */
  const baseline = React.useRef<string[]>([]);
  const dropped = React.useRef(false);
  /**
   * Row elements by id. The HANDLE is the drag source — `draggable` on the row, armed from a React
   * state change on pointer-down, is a race the browser can lose: it decides whether a drag may
   * start from the attribute as it was at mousedown. Dragging from the handle and then swapping in
   * the row as the drag image gets the same look with no timing dependency at all.
   */
  const rowRefs = React.useRef(new Map<string, HTMLDivElement>());

  // A fresh server order always wins: once `router.refresh()` lands the optimistic copy is dropped.
  // While the request is in flight `ids` has not changed yet, so the moved row never jumps back.
  // Adjusted during render rather than in an effect — resetting state from a changed prop in an
  // effect costs a second render pass, and `stale` keeps this pass's output correct too.
  const [syncedKey, setSyncedKey] = React.useState(key);
  const stale = syncedKey !== key;
  if (stale) {
    setSyncedKey(key);
    setOverride(null);
  }

  const order = (stale ? null : override) ?? ids;
  const count = order.length;
  const canSort = !disabled && count > 1;
  const indexOf = React.useCallback((id: string) => order.indexOf(id), [order]);

  const commit = React.useCallback(
    async (next: string[], announce: string) => {
      setOverride(next);
      setSaving(true);
      setMessage(announce);
      try {
        await onCommit(next);
      } catch {
        // The caller has already surfaced the error; put the rows back where they were.
        setOverride(null);
        setMessage("The new order could not be saved. The previous order has been restored.");
      } finally {
        setSaving(false);
      }
    },
    [onCommit]
  );

  const moveBy = React.useCallback(
    (id: string, delta: -1 | 1) => {
      if (!canSort || saving) return;
      const from = order.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= order.length) return;
      void commit(moved(order, from, to), `${labelOf(id)} moved to position ${to + 1} of ${order.length}.`);
    },
    [canSort, saving, order, commit, labelOf]
  );

  /* ─── Keyboard pick up / drop ─── */
  const grab = (id: string) => {
    baseline.current = order;
    setGrabbedId(id);
    setMessage(`${labelOf(id)} picked up, position ${indexOf(id) + 1} of ${count}. Use the up and down arrow keys to move it, Enter to drop it, Escape to cancel.`);
  };

  const drop = (id: string) => {
    setGrabbedId(null);
    if (order.join(",") === baseline.current.join(",")) {
      setMessage(`${labelOf(id)} dropped at position ${indexOf(id) + 1} of ${count}. The order did not change.`);
      return;
    }
    void commit(order, `${labelOf(id)} dropped at position ${order.indexOf(id) + 1} of ${order.length}. Saving the new order.`);
  };

  const cancel = (id: string) => {
    setGrabbedId(null);
    setOverride(baseline.current.length ? baseline.current : null);
    setMessage(`Reorder cancelled. ${labelOf(id)} is back at position ${baseline.current.indexOf(id) + 1} of ${baseline.current.length}.`);
  };

  const handleProps = (id: string): React.ComponentProps<"button"> => {
    const grabbed = grabbedId === id;
    return {
      type: "button",
      disabled: !canSort || saving,
      "aria-roledescription": "Sortable item",
      "aria-describedby": instructionsId,
      "aria-pressed": grabbed,
      "aria-label": `Reorder ${labelOf(id)}, position ${indexOf(id) + 1} of ${count}`,
      draggable: canSort && !saving,
      onDragStart: (e) => {
        if (!canSort || saving) return;
        baseline.current = order;
        dropped.current = false;
        setDraggingId(id);
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag with no payload at all.
        e.dataTransfer.setData("text/plain", id);
        // Drag the whole row, not the 36px handle the pointer is actually on.
        const row = rowRefs.current.get(id);
        if (row) e.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setOverId(null);
        // Released outside any row: undo the live preview.
        if (!dropped.current) setOverride(baseline.current.length ? baseline.current : null);
      },
      onBlur: () => {
        if (grabbedId === id) drop(id);
      },
      onKeyDown: (e) => {
        if (!canSort || saving) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (grabbed) drop(id);
          else grab(id);
          return;
        }
        if (e.key === "Escape" && grabbed) {
          e.preventDefault();
          cancel(id);
          return;
        }
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? -1 : 1;
        if (!grabbed) {
          // Not picked up: the arrows still move the row and save straight away, so the keyboard
          // path works for someone who never discovers the pick-up gesture.
          moveBy(id, delta);
          return;
        }
        const from = order.indexOf(id);
        const to = from + delta;
        if (to < 0 || to >= order.length) {
          setMessage(`${labelOf(id)} is already ${delta < 0 ? "first" : "last"}.`);
          return;
        }
        setOverride(moved(order, from, to));
        setMessage(`${labelOf(id)}, position ${to + 1} of ${order.length}.`);
      },
    };
  };

  /** The row is the drop TARGET (and the drag image); the handle is the drag source. */
  const rowProps = (id: string): React.ComponentProps<"div"> => ({
    ref: (el: HTMLDivElement | null) => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    },
    onDragOver: (e) => {
      if (!draggingId || draggingId === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverId(id);
      const from = order.indexOf(draggingId);
      const to = order.indexOf(id);
      if (from < 0 || to < 0 || from === to) return;
      setOverride(moved(order, from, to));
    },
    onDragLeave: () => setOverId((cur) => (cur === id ? null : cur)),
    onDrop: (e) => {
      if (!draggingId) return;
      e.preventDefault();
      dropped.current = true;
      const dragged = draggingId;
      setDraggingId(null);
      setOverId(null);
      if (order.join(",") === baseline.current.join(",")) return;
      void commit(order, `${labelOf(dragged)} moved to position ${order.indexOf(dragged) + 1} of ${order.length}. Saving the new order.`);
    },
  });

  return { order, saving, grabbedId, draggingId, overId, instructionsId, message, indexOf, count, canSort, moveBy, handleProps, rowProps };
}

/** The always-present instructions every drag handle points at with `aria-describedby`. */
export function SortInstructions({ id, itemLabel }: { id: string; itemLabel: string }) {
  return (
    <p id={id} className="sr-only">
      Press Space or Enter to pick up this {itemLabel}, then use the up and down arrow keys to move it and Enter to drop it. Press Escape to cancel. The arrow keys also move it directly without picking it up, and the Move up and Move down buttons do the same.
    </p>
  );
}

/** The one polite live region per sortable list. */
export function SortStatus({ message }: { message: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

/** The grab handle — and the keyboard entry point, so it is a real 44px button, not a bare icon. */
export function DragHandle({ sortable, id, className }: { sortable: Sortable; id: string; className?: string }) {
  const grabbed = sortable.grabbedId === id;
  return (
    <button
      {...sortable.handleProps(id)}
      className={cn(
        "ring-focus tap-highlight-none inline-flex h-11 w-9 shrink-0 cursor-grab items-center justify-center rounded-md text-muted transition-colors duration-micro hover:bg-surface hover:text-ink disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none",
        grabbed && "bg-orange-light text-orange",
        className
      )}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** Explicit Move up / Move down — the reorder path that needs no gesture and no discovery. */
export function ReorderButtons({ sortable, id, what, size = "sm" }: { sortable: Sortable; id: string; what: string; size?: "sm" | "md" }) {
  const index = sortable.indexOf(id);
  return (
    <>
      <IconButton size={size} icon={<ArrowUp className="h-4 w-4" />} aria-label={`Move ${what} up`} onClick={() => sortable.moveBy(id, -1)} disabled={!sortable.canSort || sortable.saving || index <= 0} />
      <IconButton size={size} icon={<ArrowDown className="h-4 w-4" />} aria-label={`Move ${what} down`} onClick={() => sortable.moveBy(id, 1)} disabled={!sortable.canSort || sortable.saving || index < 0 || index >= sortable.count - 1} />
    </>
  );
}

/** Row treatment shared by every sortable list: the dragged row dims, the drop target is tinted. */
export function sortableRowClasses(sortable: Sortable, id: string) {
  return cn(
    "transition-colors duration-micro motion-reduce:transition-none",
    sortable.draggingId === id && "opacity-50",
    sortable.overId === id && "bg-orange-light/40",
    sortable.grabbedId === id && "ring-2 ring-orange ring-inset"
  );
}
