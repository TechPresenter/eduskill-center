"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/tabs";
import { Card, CardBody } from "@/components/ui/card";
import { Pagination } from "@/components/ui/table";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { useApi } from "@/components/trainer/use-api";

interface Item {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}
interface Page {
  items: Item[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  unread: number;
}

const LIMIT = 20;

export function NotificationsClient() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const { data, error, loading, reload, setData } = useApi<Page>(`/api/trainer/notifications?page=${page}&limit=${LIMIT}${unreadOnly ? "&unread=true" : ""}`);

  const markRead = async (n: Item) => {
    if (n.readAt) return;
    const readAt = new Date().toISOString();
    setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === n.id ? { ...i, readAt } : i)) }));
    try {
      await api.post(`/api/trainer/notifications/${n.id}/read`);
      router.refresh();
    } catch (e) {
      toast.error("Could not mark as read", errorMessage(e));
      reload();
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ count: number }>("/api/trainer/notifications/read-all");
      toast.success(r.count ? `${r.count} notification${r.count === 1 ? "" : "s"} marked as read` : "Nothing to mark");
      reload();
      router.refresh();
    } catch (e) {
      toast.error("Could not mark all as read", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          value={unreadOnly ? "unread" : "all"}
          onChange={(v) => {
            setUnreadOnly(v === "unread");
            setPage(1);
          }}
          items={[
            { value: "all", label: "All" },
            { value: "unread", label: data ? `Unread (${data.unread})` : "Unread" },
          ]}
        />
        <Button variant="outline" size="sm" onClick={markAll} loading={busy} disabled={!data || data.unread === 0} leftIcon={<CheckCheck className="h-4 w-4" />}>
          Mark all as read
        </Button>
      </div>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="space-y-3">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-7 w-7" />} title={unreadOnly ? "You're all caught up" : "No notifications yet"} description={unreadOnly ? "There are no unread notifications." : "Notifications about your batches, assignments and the Foundation will appear here."} />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {data.items.map((n) => {
                const unread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => markRead(n)}
                      className={cn("flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy/40", unread && "bg-orange-light/30")}
                      aria-label={unread ? `${n.title} (unread). Mark as read` : n.title}
                    >
                      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", unread ? "bg-orange" : "bg-line")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", unread ? "font-bold text-navy" : "font-medium text-ink")}>{n.title}</span>
                        <span className="mt-0.5 block text-sm whitespace-pre-line text-muted">{n.body}</span>
                        <span className="mt-1 block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
      {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} className="mt-5" />}
    </>
  );
}
