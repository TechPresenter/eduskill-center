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
import type { NotificationCategory } from "@/lib/notifications/categories";
import { cn } from "@/lib/utils";
import { categoryOf } from "@/lib/notifications/categories";

interface Page {
  items: TrainerNotification[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  unread: number;
  unreadByCategory?: Partial<Record<NotificationCategory, number>>;
}

/**
 * Chips offered to a trainer: the categories trainer events actually land in (see EVENT_CATEGORY).
 * Application / Payment / Certificate are student-only, so a trainer is never shown a chip that can
 * only ever be empty. A category with unread items still gets a chip, whatever it is.
 */
const LIMIT = 20;

const TRAINER_CATEGORIES: NotificationCategory[] = ["Training", "Attendance", "Admission", "System"];

function url(page: number, unreadOnly: boolean, category: NotificationCategory | null) {
  const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (unreadOnly) p.set("unread", "true");
  if (category) p.set("category", category);
  return `/api/trainer/notifications?${p.toString()}`;
}


/**
 * Trainer inbox. Same shape as the student inbox: every row carries a category icon, opens the screen
 * the notification is about (see `trainerLinkFor`) and has a separate 44px mark-as-read control.
 * Phones append pages with "Load more"; desktop keeps the numeric pager.
 */
export function NotificationsClient() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [category, setCategory] = React.useState<NotificationCategory | null>(null);
  const [page, setPage] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [extra, setExtra] = React.useState<TrainerNotification[]>([]);
  const [loadedPage, setLoadedPage] = React.useState(1);
  const [read, setRead] = React.useState<Set<string>>(new Set());

  const { data, error, loading, reload, setData } = useApi<Page>(url(page, unreadOnly, category));

  // A new server page (filter change, refresh, pager) drops anything appended by "Load more".
  const key = `${unreadOnly}|${category ?? ""}|${page}`;
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
      setData((d) => {
        const row = d.items.find((i) => i.id === id);
        const byCat = { ...(d.unreadByCategory ?? {}) };
        if (row && !row.readAt) {
          const c = categoryOf(row.templateKey);
          byCat[c] = Math.max(0, (byCat[c] ?? 0) - 1);
        }
        return { ...d, unread: Math.max(0, d.unread - 1), unreadByCategory: byCat, items: d.items.map((i) => (i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i)) };
      });
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
      const res = await api.get<Page>(url(next, unreadOnly, category));
      setExtra((prev) => [...prev, ...res.items]);
      setLoadedPage(next);
    } catch (e) {
      toast.error("Could not load more notifications", errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const all = data ? [...data.items, ...extra] : [];
  const byCat = data?.unreadByCategory ?? {};
  const chips: (NotificationCategory | null)[] = [null, ...TRAINER_CATEGORIES, ...(Object.keys(byCat) as NotificationCategory[]).filter((c) => (byCat[c] ?? 0) > 0 && !TRAINER_CATEGORIES.includes(c))];

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Notification categories" className="hscroll gap-2 py-0.5">
        {chips.map((c) => {
          const active = c === category;
          const count = c === null ? (data?.unread ?? 0) : (byCat[c] ?? 0);
          return (
            <button
              key={c ?? "All"}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-body-sm font-semibold whitespace-nowrap tap-highlight-none ring-focus transition-colors duration-micro motion-reduce:transition-none",
                active ? "border-navy bg-navy text-white" : "border-line bg-white text-ink active:bg-surface"
              )}
            >
              {c ?? "All"}
              {count > 0 && (
                <span className={cn("rounded-full px-1.5 text-caption font-bold tabular-nums", active ? "bg-white/20 text-white" : "bg-orange text-white")}>
                  <span className="sr-only">, unread: </span>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

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
          title={unreadOnly ? "You're all caught up" : category ? `No ${category.toLowerCase()} notifications` : "No notifications yet"}
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
