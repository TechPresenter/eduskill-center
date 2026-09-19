import { apiHandler, parseBody } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { getAllSettings, SETTING_DEFAULTS, SETTING_GROUPS, setSettings } from "@/lib/settings";
import { normalizeSettingValues, settingsUpdateSchema } from "@/app/admin/settings/lib";

export const GET = apiHandler({ permission: "settings.view" }, async () => ({ groups: SETTING_GROUPS, values: await getAllSettings() }));

/** PUT { values: { "group.key": value, … } } – masked secrets ("••••••••") are left unchanged. */
export const PUT = apiHandler({ permission: "settings.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, settingsUpdateSchema);
  const values = normalizeSettingValues(body.values);
  const before = await getAllSettings();
  await setSettings(values, user!.id);
  const after = await getAllSettings();
  const changedKeys = Object.keys(values).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]) || (SETTING_DEFAULTS[k]?.secret && values[k] !== "••••••••"));
  const redact = (src: Record<string, unknown>) => Object.fromEntries(changedKeys.map((k) => [k, SETTING_DEFAULTS[k]?.secret ? "[secret]" : src[k]]));
  if (changedKeys.length) {
    const groups = Array.from(new Set(changedKeys.map((k) => SETTING_DEFAULTS[k]?.group).filter(Boolean)));
    await audit({ user: user!, action: "update", module: "settings", recordType: "Setting", recordId: groups.join(","), description: `${user!.name} updated ${changedKeys.length} setting(s) in ${groups.join(", ")}`, oldValue: redact(before), newValue: redact(after), ip, userAgent });
  }
  return { values: after, changed: changedKeys };
});
