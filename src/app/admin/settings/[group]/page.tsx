import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAllSettings, SETTING_GROUPS } from "@/lib/settings";
import { settingGroup, settingsGroupFields } from "@/app/admin/settings/lib";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { SettingsForm, type SettingFieldDef } from "@/components/admin/settings/settings-form";

export const metadata: Metadata = { title: "Settings · Foundation Admin" };

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-surface px-1 py-0.5 text-[0.9em] text-navy">{children}</code>;

/**
 * Notes shown above a group's fields, for groups whose behaviour is not obvious from the
 * field labels alone (where the switch actually takes effect, what it costs).
 */
const GROUP_NOTES: Record<string, { title: string; body: React.ReactNode }> = {
  chatbot: {
    title: "What this page controls",
    body: (
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>
          These settings drive the chat assistant that <strong>visitors</strong> see on the public website. It answers from this platform&rsquo;s own data
          (courses, centres, fees, contact details) in Hindi and English. It is not used anywhere in the admin or the portals.
        </li>
        <li>
          The OpenAI key is deliberately <strong>not</strong> a setting. The assistant stays hidden — for everyone, whatever is ticked below — until{" "}
          <Code>OPENAI_API_KEY</Code> is set in the server&rsquo;s <Code>.env</Code> file and the service is restarted. Everything else on the site is unaffected.
        </li>
        <li>
          Every answer is charged by OpenAI to the Foundation&rsquo;s account. The <strong>model</strong> and the{" "}
          <strong>maximum messages per visitor per hour</strong> below are what decide that bill: a larger model costs more per answer, and the hourly limit
          caps how much one visitor (or one script) can spend.
        </li>
      </ul>
    ),
  },
};

export default async function SettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const user = await requireAdmin("settings.view");
  const { group } = await params;
  const def = settingGroup(group);
  if (!def) notFound();
  const [values, fields] = await Promise.all([getAllSettings(), Promise.resolve(settingsGroupFields(group) as SettingFieldDef[])]);
  const groupValues: Record<string, unknown> = {};
  for (const f of fields) groupValues[f.key] = values[f.key];
  const note = GROUP_NOTES[def.key];

  return (
    <div>
      <PageHeader title="Settings" mobileTitle={def.label} description="Branding, contact details, ID formats, admissions, payments, communication and more – all stored in the database, no deployment needed." />
      <SettingsTabs groups={SETTING_GROUPS} />
      <Card className="max-w-4xl">
        <CardHeader title={def.label} description={def.description} />
        <CardBody>
          {note && (
            <Alert tone="info" title={note.title} className="mb-6">
              {note.body}
            </Alert>
          )}
          <SettingsForm group={def.key} groupLabel={def.label} fields={fields} values={groupValues} canUpdate={hasPermission(user, "settings.update")} defaultTestEmail={user.email ?? ""} />
        </CardBody>
      </Card>
    </div>
  );
}
