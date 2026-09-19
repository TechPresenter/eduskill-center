import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { SETTING_GROUPS } from "@/lib/settings";
import { listImpactStats } from "@/app/admin/settings/lib";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { ImpactStatsEditor } from "@/components/admin/settings/impact-stats-editor";

export const metadata: Metadata = { title: "Impact Stats · Foundation Admin" };

export default async function ImpactStatsPage() {
  const user = await requireAdmin("settings.view");
  const rows = await listImpactStats();
  return (
    <div>
      <PageHeader title="Settings" mobileTitle="Impact stats" description="Impact numbers shown on the website home page." />
      <SettingsTabs groups={SETTING_GROUPS} />
      <Card>
        <CardHeader title="Impact stats" description="Automatic stats are computed live from the database; switch a stat to manual to display a fixed number instead." />
        <CardBody>
          <ImpactStatsEditor rows={rows} canUpdate={hasPermission(user, "settings.update")} />
        </CardBody>
      </Card>
    </div>
  );
}
