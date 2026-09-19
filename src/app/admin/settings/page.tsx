import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { SETTING_GROUPS } from "@/lib/settings";

export default async function SettingsIndexPage() {
  await requireAdmin("settings.view");
  redirect(`/admin/settings/${SETTING_GROUPS[0]!.key}`);
}
