"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, Bell, BookOpen, Check, CheckCheck, ClipboardCheck, ClipboardList, CreditCard, GraduationCap, type LucideIcon } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { NOTIFICATION_CATEGORIES, categoryOf, type NotificationCategory } from "@/lib/notifications/categories";

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  templateKey: string | null;
  readAt: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  Application: ClipboardList,
  Admission: GraduationCap,
  Payment: CreditCard,
  Training: BookOpen,
  Attendance: ClipboardCheck,
  Certificate: Award,
  System: Bell,
};

/** Best-effort deep link derived from the notification payload. */
function linkFor(n: InboxItem): string | null {
  const d = n.data ?? {};
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  if (str("applicationId")) return `/student/applications/${str("applicationId")}`;
  if (str("paymentId") || str("receiptNo")) return "/student/payments";
  if (str("certificateNo") || str("certificateId")) return "/student/certificates";
  if (str("ticketId")) return `/student/support/${str("ticketId")}`;
  if (str("ticketNo")) return "/student/support";
  if (str("batch") || str("schedule")) return "/student/timetable";
  if (str("attendancePct")) return "/student/attendance";
  if (str("applicationNo")) return "/student/applications";
  return null;
}

function chipHref(category: NotificationCategory | "All", unreadOnly: boolean) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (unreadOnly) params.set("unread", "1");
  const q = params.toString();
  return q ? `/student/notifications?${q}` : "/student/notifications";
}

export interface NotificationsInboxProps {
  items: InboxItem[];
  unread: number;
  unreadOnly: boolean;
  category?: NotificationCategory;
  /** Unread count per category for the chip badges. */
  unreadByCategory?: Partial<Record<NotificationCategory, number>>;
  page: number;
  totalPages: number;
}

/**
 * In-app inbox: a horizontally scrolling category chip row, tappable 64px rows with a category icon
 * tile and a 44px mark-as-read control, plus a "Load more" button that appends pages on phones
 * (the numeric Pagination stays for desktop, rendered by the page).
 */
export function NotificationsInbox({ items, unread, unreadOnly, category, unreadByCategory = {}, page, totalPages }: NotificationsInboxProps) {
  const router = useRouter();
  const [extra, setExtra] = React.useState<InboxItem[]>([]);
  const [loadedPage, setLoadedPage] = React.useState(page);
  const [read, setRead] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // A new server page (filter change / refresh) resets the appended list.
  const [lastKey, setLastKey] = React.useState(`${category ?? ""}|${unreadOnly}|${page}`);
  const key = `${category ?? ""}|${unreadOnly}|${page}`;
  if (lastKey !== key) {
    setLastKey(key);
    setExtra([]);
    setLoadedPage(page);
  }

  const all = React.useMemo(() => [...items, ...extra], [items, extra]);

  const markOne = async (id: string) => {
    if (read.has(id)) return;
    setRead((s) => new Set(s).add(id));
    try {
      await api.post(`/api/student/notifications/${id}/read`);
      router.refresh();
    } catch (err) {
      toast.error("Could not mark as read", errorMessage(err));
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ marked: number }>("/api/student/notifications/read-all");
      toast.success(r.marked ? `${r.marked} notification${r.marked === 1 ? "" : "s"} marked as read` : "Nothing to mark");
      router.refresh();
    } catch (err) {
      toast.error("Could not mark all as read", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const next = loadedPage + 1;
    const params = new URLSearchParams({ page: String(next), limit: "25" });
    if (category) params.set("category", category);
    if (unreadOnly) params.set("unread", "true");
    try {
      const res = await api.get<{ items: InboxItem[] }>(`/api/student/notifications?${params.toString()}`);
      setExtra((prev) => [...prev, ...res.items]);
      setLoadedPage(next);
    } catch (err) {
      toast.error("Could not load more notifications", errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const chips: (NotificationCategory | "All")[] = ["All", ...NOTIFICATION_CATEGORIES];

  return (
    <div className="space-y-3">
      <nav aria-label="Notification categories" className="hscroll gap-2 py-0.5">
        {chips.map((c) => {
          const active = c === "All" ? !category : category === c;
          const count = c === "All" ? unread : (unreadByCategory[c] ?? 0);
          return (
            <Link
              key={c}
              href={chipHref(c, unreadOnly)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap tap-highlight-none transition-colors",
                active ? "border-navy bg-navy text-white" : "border-line bg-white text-ink active:bg-surface"
              )}
            >
              {c}
              {count > 0 && <span className={cn("rounded-full px-1.5 text-[12px] font-bold tabular-nums", active ? "bg-white/20 text-white" : "bg-orange text-white")}>{count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={chipHref(category ?? "All", !unreadOnly)}
          className={cn("inline-flex min-h-11 items-center rounded-xl border px-3.5 text-[13px] font-semibold", unreadOnly ? "border-navy bg-navy text-white" : "border-line bg-white text-ink")}
        >
          {unreadOnly ? "Showing unread only" : `Unread only${unread ? ` (${unread})` : ""}`}
        </Link>
        <Button variant="outline" size="sm" onClick={() => void markAll()} loading={busy} disabled={unread === 0} leftIcon={<CheckCheck className="h-4 w-4" />}>
          Mark all as read
        </Button>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title={unreadOnly ? "No unread notifications" : category ? `No ${category.toLowerCase()} notifications` : "No notifications yet"}
          description="Updates about your applications, payments, classes and certificates appear here."
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {all.map((n) => {
            const isUnread = !n.readAt && !read.has(n.id);
            const href = linkFor(n);
            const cat = categoryOf(n.templateKey);
            const Icon = CATEGORY_ICONS[cat];
            const body = (
              <>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", isUnread ? "bg-orange-light text-orange" : "bg-lavender text-navy")}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[14px]", isUnread ? "font-bold text-navy" : "font-semibold text-ink")}>{n.title}</span>
                    {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-orange" aria-label="Unread" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{n.body}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {cat} · {formatDateTime(n.createdAt)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={n.id} className={cn("flex items-start gap-1", isUnread ? "bg-orange-light/25" : "bg-white")}>
                {href ? (
                  <Link href={href} onClick={() => void markOne(n.id)} className="flex min-h-16 min-w-0 flex-1 items-start gap-3 px-4 py-3 tap-highlight-none active:bg-surface/70">
                    {body}
                  </Link>
                ) : (
                  <button type="button" onClick={() => void markOne(n.id)} className="flex min-h-16 min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left tap-highlight-none active:bg-surface/70">
                    {body}
                  </button>
                )}
                {isUnread && (
                  <IconButton
                    aria-label={`Mark "${n.title}" as read`}
                    icon={<Check className="h-5 w-5" />}
                    onClick={() => void markOne(n.id)}
                    className="mt-3 mr-1 shrink-0"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {loadedPage < totalPages && (
        <Button variant="outline" fullWidth onClick={() => void loadMore()} loading={loadingMore} className="lg:hidden">
          Load more
        </Button>
      )}
    </div>
  );
}
