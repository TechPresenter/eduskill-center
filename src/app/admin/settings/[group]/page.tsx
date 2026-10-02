import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAllSettings, isSuperAdminOnlyGroup, isSuperAdminOnlySetting, SETTING_GROUPS } from "@/lib/settings";
// Server-only, and it must stay that way: it returns a boolean about process.env, never the value.
import { isChatbotConfigured } from "@/server/chatbot";
// A boolean about process.env.DATA_ENCRYPTION_KEY, never the key.
import { isEncryptionConfigured } from "@/lib/crypto";
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
  comms: {
    title: "How outgoing email is sent",
    body: (
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>
          <strong>Encryption</strong> must match the port: <strong>SSL/TLS</strong> with port <Code>465</Code>, or <strong>STARTTLS</strong> with port{" "}
          <Code>587</Code> (the connection is upgraded to TLS before the password is sent; a server that cannot do so is refused). For Hostinger use{" "}
          <Code>smtp.hostinger.com</Code>.
        </li>
        <li>
          <strong>From email</strong> is the address every email is sent as (admin sign-in codes, notifications and Admin → Send Email), so it must be a
          mailbox the SMTP account may send as, normally the SMTP user itself. <strong>From name</strong> is the display name next to it.{" "}
          <strong>Reply-To</strong> is optional: replies go there instead of the From address.
        </li>
        <li>
          The SMTP password is stored <strong>encrypted</strong> on the server and is never shown again after saving — to change it, type a new one. Use{" "}
          <strong>Send test email</strong> after saving to confirm delivery.
        </li>
      </ul>
    ),
  },
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
  // Email transport and security switches: Super Admin only (the API refuses them too).
  if (isSuperAdminOnlyGroup(def.key) && user.role !== "SUPER_ADMIN") redirect("/admin/forbidden");
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const [values, groupFields] = await Promise.all([getAllSettings(), Promise.resolve(settingsGroupFields(group) as SettingFieldDef[])]);
  // Super-Admin-only keys inside an otherwise shared group (e.g. sending limits under Email Signature & Limits)
  // render read-only for staff; the settings API refuses them as well.
  const fields = groupFields.map((f) => ({ ...f, superAdminOnly: isSuperAdminOnlySetting(f.key) }));
  // Staff never see tabs for groups they would only be bounced from.
  const visibleGroups = isSuperAdmin ? SETTING_GROUPS : SETTING_GROUPS.filter((g) => !isSuperAdminOnlyGroup(g.key));
  const groupValues: Record<string, unknown> = {};
  for (const f of fields) groupValues[f.key] = values[f.key];
  const note = GROUP_NOTES[def.key];
  // Computed only for the chatbot group, so no other group pays for a status nobody renders.
  // `!== false` mirrors getChatbotConfig() exactly: until someone saves this form there are no
  // `chatbot.*` rows at all, and an absent value means the default `true`, not "switched off".
  const chatbot = def.key === "chatbot" ? { keyPresent: isChatbotConfigured(), toggleOn: groupValues["chatbot.enabled"] !== false } : null;
  // Communication only: the "stored encrypted" promise in the note holds only with DATA_ENCRYPTION_KEY set.
  const commsUnencrypted = def.key === "comms" && !isEncryptionConfigured();

  return (
    // One rhythm between the page title, the group tabs and the panel — settings used to have none.
    <div className="space-y-5">
      <PageHeader title="Settings" mobileTitle={def.label} description="Branding, contact details, ID formats, admissions, payments, communication and more – all stored in the database, no deployment needed." />
      <SettingsTabs groups={visibleGroups} />
      <Card className="max-w-4xl">
        <CardHeader title={def.label} description={def.description} />
        <CardBody>
          {note && (
            <Alert tone="info" title={note.title} className="mb-6">
              {note.body}
            </Alert>
          )}
          {commsUnencrypted && (
            <Alert tone="warning" title="Passwords saved here are not encrypted yet" className="mb-6">
              <p>
                This server has no <Code>DATA_ENCRYPTION_KEY</Code>, so a password saved below is stored as plain text in the database. Add the key to the
                server&rsquo;s <Code>.env</Code> (<Code>openssl rand -base64 32</Code>), restart the service, then save the SMTP password again.
              </p>
            </Alert>
          )}
          {/*
            The one fact an admin cannot learn from the fields below: whether this server actually has a key.
            Without it, ticking "AI assistant enabled", saving, and then finding nothing on the public site is a
            dead end with no diagnosis. Deliberately a BOOLEAN and nothing more — no prefix, no masked form, no
            character count, no log — so a settings page can never turn into a secret-disclosure page.
          */}
          {chatbot &&
            (!chatbot.keyPresent ? (
              <Alert tone="warning" title="No OpenAI key on this server" className="mb-6">
                <p>
                  The assistant is hidden from every visitor, no matter what is ticked below. An administrator with server access must add <Code>OPENAI_API_KEY</Code> to
                  the server&rsquo;s <Code>.env</Code> file and restart the service. The key is deliberately not a setting on this page, and it must never be pasted into a
                  form here.
                </p>
              </Alert>
            ) : !chatbot.toggleOn ? (
              <Alert tone="info" title="Key detected — the assistant is switched off" className="mb-6">
                <p>The server has an OpenAI key, so the only thing hiding the assistant from visitors is the &ldquo;AI assistant enabled&rdquo; switch below.</p>
              </Alert>
            ) : (
              <Alert tone="success" title="Key detected — the assistant is live" className="mb-6">
                <p>
                  The server has an OpenAI key and the switch is on, so visitors see the assistant on the public website. Every answer is billed to the
                  Foundation&rsquo;s OpenAI account.
                </p>
              </Alert>
            ))}
          <SettingsForm group={def.key} groupLabel={def.label} fields={fields} values={groupValues} canUpdate={hasPermission(user, "settings.update")} isSuperAdmin={isSuperAdmin} defaultTestEmail={user.email ?? ""} />
        </CardBody>
      </Card>
    </div>
  );
}
