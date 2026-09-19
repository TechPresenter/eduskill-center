import { requireTrainer } from "@/lib/auth/guards";
import { getBranding } from "@/lib/settings";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/portal/shell";
import { TRAINER_BOTTOM_NAV, TRAINER_NAV } from "@/components/trainer/nav";
import { titleCase } from "@/lib/utils";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTrainer();
  const [branding, unread] = await Promise.all([
    getBranding(),
    db.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } }),
  ]);
  return (
    <PortalShell
      nav={TRAINER_NAV}
      bottomNav={TRAINER_BOTTOM_NAV}
      user={{ name: user.name, role: "Trainer", subtitle: `${user.trainer.trainerId} · ${titleCase(user.trainer.level)} level`, avatarUrl: user.avatarUrl }}
      branding={branding}
      portalLabel="Trainer Portal"
      homeHref="/trainer/dashboard"
      unreadCount={unread}
      notificationsHref="/trainer/notifications"
      profileHref="/trainer/profile"
      settingsHref="/trainer/settings"
    >
      {children}
    </PortalShell>
  );
}
