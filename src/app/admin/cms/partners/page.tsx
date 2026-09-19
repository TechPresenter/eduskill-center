import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listPartners } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { PartnersManager } from "@/components/admin/cms/partners-manager";

export const metadata = { title: "Partners" };

export default async function CmsPartnersPage() {
  const user = await requireAdmin("cms.view");
  const items = await listPartners();
  return (
    <div>
      <PageHeader title="Partners" mobileTitle="Partners" backHref="/admin/cms" description="Partner and supporter logos shown in the website's partner strip." />
      <PartnersManager items={items} canEdit={hasPermission(user, "cms.update")} />
    </div>
  );
}
