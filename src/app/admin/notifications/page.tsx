import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";

const TABS = new Set(["inbox", "log", "templates", "announcements", "send"]);

/** Hub: `/admin/notifications?tab=inbox` (used by the header bell) and the bare URL both land on the right tab. */
export default async function NotificationsHubPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = raw && TABS.has(raw) ? raw : "inbox";
  redirect(`/admin/notifications/${tab}`);
}
