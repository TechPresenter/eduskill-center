import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/ui/misc";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { cmsPageFields } from "../fields";

export const metadata = { title: "New Page" };

export default async function NewCmsPage() {
  const user = await requireAdmin("cms.update");
  const canPublish = hasPermission(user, "cms.publish");
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Pages", href: "/admin/cms/pages" }, { label: "New page" }]} title="New page" description="Write the content in Markdown. The slug becomes the page address." />
      <ContentEditor
        endpoint="/api/admin/cms/pages"
        itemLabel="page"
        backHref="/admin/cms/pages"
        canEdit
        fields={cmsPageFields({ fixed: false, canPublish })}
        initial={{ title: "", slug: "", status: canPublish ? "PUBLISHED" : "DRAFT", excerpt: "", content: "", seoTitle: "", seoDescription: "" }}
      />
    </div>
  );
}
