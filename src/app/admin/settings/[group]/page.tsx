import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAllSettings, SETTING_GROUPS } from "@/lib/settings";
import { settingGroup, settingsGroupFields } from "@/app/admin/settings/lib";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { SettingsForm, type SettingFieldDef } from "@/components/admin/settings/settings-form";

export const metadata: Metadata = { title: "Settings · Foundation Admin" };

export default async function SettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const user = await requireAdmin("settings.view");
  const { group } = await params;
  const def = settingGroup(group);
  if (!def) notFound();
  const [values, fields] = await Promise.all([getAllSettings(), Promise.resolve(settingsGroupFields(group) as SettingFieldDef[])]);
  const groupValues: Record<string, unknown> = {};
  for (const f of fields) groupValues[f.key] = values[f.key];

  return (
    <div>
      <PageHeader title="Settings" mobileTitle={def.label} description="Branding, contact details, ID formats, admissions, payments, communication and more – all stored in the database, no deployment needed." />
      <SettingsTabs groups={SETTING_GROUPS} />
      <Card className="max-w-4xl">
        <CardHeader title={def.label} description={def.description} />
        <CardBody>
          <SettingsForm group={def.key} groupLabel={def.label} fields={fields} values={groupValues} canUpdate={hasPermission(user, "settings.update")} defaultTestEmail={user.email ?? ""} />
        </CardBody>
      </Card>
    </div>
  );
}
