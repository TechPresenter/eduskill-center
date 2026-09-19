import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSectionForEdit } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { SectionEditor } from "@/components/admin/cms/section-editor";

export const metadata = { title: "Edit Section" };

export default async function CmsSectionEditPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireAdmin("cms.view");
  const { key } = await params;
  const section = await getSectionForEdit(decodeURIComponent(key)).catch(() => null);
  if (!section) notFound();
  const { def, data, customised, updatedAt } = section;

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Website sections", href: "/admin/cms/sections" }, { label: def.page }, { label: def.name }]} title={def.name} description={def.description} />
      <SectionEditor section={{ key: def.key, name: def.name, page: def.page, description: def.description, fields: def.fields, defaults: def.defaults, data, customised, updatedAt }} canEdit={hasPermission(user, "cms.update")} />
    </div>
  );
}
