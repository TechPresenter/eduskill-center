"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/table";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { useApi } from "@/components/trainer/use-api";
import { NotificationRow, type TrainerNotification } from "@/components/trainer/mobile";

interface Page {
  items: TrainerNotification[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  unread: number;
}

const LIMIT = 20;

/**
 * Trainer inbox. Same shape as the student inbox: every row carries a category icon, opens the screen
 * the notification is about (see `trainerLinkFor`) and has a separate 44px mark-as-read control.
 * Phones append pages with "Load more"; desktop keeps the numeric pager.
 */
export function NotificationsClient() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [extra, setExtra] = React.useState<TrainerNotification[]>([]);
  const [loadedPage, setLoadedPage] = React.useState(1);
  const [read, setRead] = React.useState<Set<string>>(new Set());

  const { data, error, loading, reload, setData } = useApi<Page>(`/api/trainer/notifications?page=${page}&limit=${LIMIT}${unreadOnly ? "&unread=true" : ""}`);

  // A new server page (filter change, refresh, pager) drops anything appended by "Load more".
  const key = `${unreadOnly}|${page}`;
  const [lastKey, setLastKey] = React.useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setExtra([]);
    setLoadedPage(page);
  }

  const markRead = React.useCallback(
    (id: string) => {
      if (read.has(id)) return;
      setRead((s) => new Set(s).add(id));
      setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i)) }));
      api
        .post(`/api/trainer/notifications/${id}/read`)
        .then(() => router.refresh())
        .catch((e) => {
          toast.error("Could not mark as read", errorMessage(e));
          reload();
        });
    },
    [read, setData, reload, router]
  );

  const markAll = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ count: number }>("/api/trainer/notifications/read-all");
      toast.success(r.count ? `${r.count} notification${r.count === 1 ? "" : "s"} marked as read` : "Nothing to mark");
      setExtra([]);
      setLoadedPage(page);
      reload();
      router.refresh();
    } catch (e) {
      toast.error("Could not mark all as read", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!data) return;
    setLoadingMore(true);
    const next = loadedPage + 1;
    try {
      const res = await api.get<Page>(`/api/trainer/notifications?page=${next}&limit=${LIMIT}${unreadOnly ? "&unread=true" : ""}`);
      setExtra((prev) => [...prev, ...res.items]);
      setLoadedPage(next);
    } catch (e) {
      toast.error("Could not load more notifications", errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const all = data ? [...data.items, ...extra] : [];

  return (
    <div className="space-y-3">
      {/* One row at every width: the filter on the left, the bulk action on the right. The label
          shortens below `sm` so the pair still fits inside a 360px viewport. */}
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          value={unreadOnly ? "unread" : "all"}
          onChange={(v) => {
            setUnreadOnly(v === "unread");
            setPage(1);
          }}
          className="shrink-0"
          items={[
            { value: "all", label: "All" },
            { value: "unread", label: data ? `Unread (${data.unread})` : "Unread" },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => void markAll()} loading={busy} disabled={!data || data.unread === 0} leftIcon={<CheckCheck className="h-4 w-4" />} className="shrink-0">
          <span className="sm:hidden">Mark all read</span>
          <span className="hidden sm:inline">Mark all as read</span>
        </Button>
      </div>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonList rows={6} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title={unreadOnly ? "You're all caught up" : "No notifications yet"}
          description={unreadOnly ? "There are no unread notifications." : "Updates about your batches, assignments and the Foundation will appear here."}
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {all.map((n) => (
            <NotificationRow key={n.id} notification={n} read={read.has(n.id)} onMarkRead={markRead} />
          ))}
        </ul>
      )}

      {data && loadedPage < data.meta.totalPages && (
        <Button variant="outline" fullWidth onClick={() => void loadMore()} loading={loadingMore} className="lg:hidden">
          Load more
        </Button>
      )}
      {data && data.meta.totalPages > 1 && (
        <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} className="hidden lg:flex" />
      )}
    </div>
  );
}
