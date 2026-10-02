import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { getAllSettings, isSuperAdminOnlySetting, SETTING_DEFAULTS, SETTING_GROUPS, setSettings } from "@/lib/settings";
import { normalizeSettingValues, settingsUpdateSchema } from "@/app/admin/settings/lib";
import { raiseSecurityAlert } from "@/server/security-alerts";

export const GET = apiHandler({ permission: "settings.view" }, async () => ({ groups: SETTING_GROUPS, values: await getAllSettings() }));

/**
 * PUT { values: { "group.key": value, … } } – masked secrets ("••••••••") are left unchanged.
 *
 * Email transport, provider credentials and security switches are Super Admin only: whoever can
 * repoint SMTP can read every administrator sign-in code. A staff member with settings.update who
 * sends one of those keys gets 403 — nothing is saved.
 */
export const PUT = apiHandler({ permission: "settings.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, settingsUpdateSchema);
  const values = normalizeSettingValues(body.values);
  if (user!.role !== "SUPER_ADMIN") {
    const restricted = Object.keys(values).filter(isSuperAdminOnlySetting);
    if (restricted.length) throw Errors.forbidden("Only a Super Admin can change email, provider credentials and security settings.");
  }
  const before = await getAllSettings();
  await setSettings(values, user!.id);
  const after = await getAllSettings();
  const changedKeys = Object.keys(values).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]) || (SETTING_DEFAULTS[k]?.secret && values[k] !== "••••••••"));
  const redact = (src: Record<string, unknown>) => Object.fromEntries(changedKeys.map((k) => [k, SETTING_DEFAULTS[k]?.secret ? "[secret]" : src[k]]));
  if (changedKeys.length) {
    const groups = Array.from(new Set(changedKeys.map((k) => SETTING_DEFAULTS[k]?.group).filter(Boolean)));
    await audit({ user: user!, action: "update", module: "settings", recordType: "Setting", recordId: groups.join(","), description: `${user!.name} updated ${changedKeys.length} setting(s) in ${groups.join(", ")}`, oldValue: redact(before), newValue: redact(after), ip, userAgent });
    const sensitive = changedKeys.filter((k) => k.startsWith("comms.smtp") || k.startsWith("security.") || SETTING_DEFAULTS[k]?.secret);
    if (sensitive.length) {
      await raiseSecurityAlert({
        type: sensitive.some((k) => k.startsWith("comms.")) ? "EMAIL_CONFIG_CHANGED" : "SECURITY_SETTINGS_CHANGED",
        severity: "warning",
        title: `${user!.name} changed ${sensitive.some((k) => k.startsWith("comms.smtp")) ? "the email (SMTP) configuration" : "sensitive settings"}`,
        detail: `Changed: ${sensitive.map((k) => SETTING_DEFAULTS[k]?.label ?? k).join(", ")}.`,
        userId: user!.id,
        ip,
        userAgent,
      });
    }
  }
  return { values: after, changed: changedKeys };
});
