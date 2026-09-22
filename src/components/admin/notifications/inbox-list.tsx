"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { IconTile } from "@/components/admin/content/app-list";

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
  templateKey: string | null;
}

/**
 * The admin's own in-app inbox. Rows read like a messaging app: an orange tile and bold title while
 * unread, the first two lines of the message, the date on the right. Tapping expands the row in place
 * and marks it read; "All / Unread" narrows the page without a round trip.
 */
export function InboxList({ items, unread }: { items: InboxItem[]; unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  // Optimistic read state, so the row turns "read" the moment it is opened.
  const [readLocal, setReadLocal] = React.useState<Set<string>>(new Set());

  const isUnread = (n: InboxItem) => !n.readAt && !readLocal.has(n.id);
  const visible = filter === "unread" ? items.filter(isUnread) : items;

  const markRead = async (id: string) => {
    setReadLocal((s) => new Set(s).add(id));
    try {
      await api.post(`/api/admin/notifications/inbox/${id}`);
      router.refresh();
    } catch (err) {
      setReadLocal((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      toast.error("Could not mark as read", err instanceof Error ? err.message : undefined);
    }
  };

  const markAll = async () => {
    setBusy("all");
    try {
      const r = await api.post<{ marked: number }>("/api/admin/notifications/inbox");
      toast.success(`${r.marked} notification${r.marked === 1 ? "" : "s"} marked as read`);
      router.refresh();
    } catch (err) {
      toast.error("Could not mark all as read", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return <EmptyState icon={<Inbox className="h-7 w-7" />} title="Your inbox is empty" description="Announcements and system notifications addressed to you will appear here." />;
  }

  // Rows read optimistically that the server still reports as unread.
  const pendingReads = items.filter((i) => !i.readAt && readLocal.has(i.id)).length;
  const unreadNow = Math.max(0, unread - pendingReads);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as "all" | "unread")}
          items={[
            { value: "all", label: "All" },
            { value: "unread", label: unreadNow ? `Unread · ${unreadNow}` : "Unread" },
          ]}
        />
        {unreadNow > 0 && (
          <Button size="sm" variant="outline" onClick={markAll} loading={busy === "all"} leftIcon={<CheckCheck className="h-4 w-4" />}>
            Mark all read
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState size="sm" icon={<CheckCheck className="h-6 w-6" />} title="All caught up" description="You have read every notification on this page." />
      ) : (
        <ul className="card animate-fade-in divide-y divide-line overflow-hidden motion-reduce:animate-none" aria-label="Notifications">
          {visible.map((n) => {
            const unreadRow = isUnread(n);
            const open = expanded === n.id;
            return (
              <li key={n.id} className={cn(unreadRow && "bg-orange-light/30")}>
                <button
                  type="button"
                  className="flex min-h-16 w-full items-start gap-3 px-4 py-3 text-left tap-highlight-none transition-colors duration-micro ease-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange active:bg-surface motion-reduce:transition-none sm:px-5 md:hover:bg-surface/60"
                  aria-expanded={open}
                  onClick={() => {
                    setExpanded(open ? null : n.id);
                    if (unreadRow) void markRead(n.id);
                  }}
                >
                  <IconTile tone={unreadRow ? "orange" : "neutral"}>
                    <Bell />
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-body", unreadRow ? "font-bold text-navy" : "font-medium text-ink")}>
                      {n.title}
                      {unreadRow && <span className="sr-only"> (unread)</span>}
                    </span>
                    {!open && <span className="mt-0.5 line-clamp-2 block text-body-sm text-muted">{n.body}</span>}
                  </span>
                  <span className="shrink-0 pt-0.5 text-caption text-muted tabular-nums" title={formatDateTime(n.createdAt)}>
                    {formatDate(n.createdAt, "dd MMM")}
                  </span>
                </button>
                {open && (
                  <div className="animate-fade-in px-4 pb-4 pl-[4.25rem] motion-reduce:animate-none sm:px-5 sm:pl-[4.5rem]">
                    <p className="text-body-sm whitespace-pre-line text-ink">{n.body}</p>
                    <p className="mt-2 text-caption text-muted">{formatDateTime(n.createdAt)}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
