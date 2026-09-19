import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";

export default async function SupportHubPage() {
  await requireAdmin("support.view");
  redirect("/admin/support/tickets");
}
