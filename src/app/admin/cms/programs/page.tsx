import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listPrograms } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { ProgramsManager } from "@/components/admin/cms/programs-manager";

export const metadata = { title: "Programs" };

export default async function CmsProgramsPage() {
  const user = await requireAdmin("cms.view");
  const items = await listPrograms();
  return (
    <div>
      <PageHeader title="Programs" mobileTitle="Programs" backHref="/admin/cms" description="The Foundation's programs shown on the homepage and the Programs page. Use the arrows to change the display order." />
      <ProgramsManager items={items} canEdit={hasPermission(user, "cms.update")} />
    </div>
  );
}
