"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
  templateKey: string | null;
}

export function InboxList({ items, unread }: { items: InboxItem[]; unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const markRead = async (id: string) => {
    setBusy(id);
    try {
      await api.post(`/api/admin/notifications/inbox/${id}`);
      router.refresh();
    } catch (err) {
      toast.error("Could not mark as read", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
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
    return <EmptyState icon={<Bell className="h-7 w-7" />} title="Your inbox is empty" description="Announcements and system notifications addressed to you will appear here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{unread ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll} loading={busy === "all"} leftIcon={<CheckCheck className="h-4 w-4" />}>
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line rounded-card border border-line bg-white">
        {items.map((n) => {
          const isUnread = !n.readAt;
          const open = expanded === n.id;
          return (
            <li key={n.id} className={cn("px-4 py-3", isUnread && "bg-orange-light/30")}>
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                aria-expanded={open}
                onClick={() => {
                  setExpanded(open ? null : n.id);
                  if (isUnread) void markRead(n.id);
                }}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isUnread ? "bg-orange" : "bg-line")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", isUnread ? "font-bold text-navy" : "font-medium text-ink")}>{n.title}</span>
                  <span className={cn("mt-0.5 block text-sm text-muted", !open && "line-clamp-2 whitespace-pre-line")}>{open ? "" : n.body}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(n.createdAt)}</span>
              </button>
              {open && <p className="mt-2 ml-5 text-sm whitespace-pre-line text-ink">{n.body}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
