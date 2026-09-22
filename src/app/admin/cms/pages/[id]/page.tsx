import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { getCmsPage } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { cmsPageFields } from "../fields";

export const metadata = { title: "Edit Page" };

export default async function EditCmsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("cms.view");
  const { id } = await params;
  const page = await getCmsPage(id).catch(() => null);
  if (!page) notFound();
  const canEdit = hasPermission(user, "cms.update");
  const canPublish = hasPermission(user, "cms.publish");

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Pages", href: "/admin/cms/pages" }, { label: page.title }]}
        mobileTitle={page.title}
        backHref="/admin/cms/pages"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {page.title}
            <StatusBadge status={page.status} />
            {page.isFixed && <Badge tone="neutral">System page</Badge>}
          </span>
        }
        description={<span className="font-mono">/{page.slug}</span>}
      />
      <ContentEditor
        publicPrefix=""
        endpoint="/api/admin/cms/pages"
        id={page.id}
        itemLabel="page"
        backHref="/admin/cms/pages"
        canEdit={canEdit}
        deleteLocked={page.isFixed ? "System pages cannot be deleted – set the status to Draft to hide them." : null}
        fields={cmsPageFields({ fixed: page.isFixed, canPublish })}
        initial={{ title: page.title, slug: page.slug, status: page.status, excerpt: page.excerpt ?? "", content: page.content, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "" }}
        meta={`Last saved ${formatDateTime(page.updatedAt)}`}
      >
        {page.isFixed && <Alert tone="info">This page is linked from the website navigation. You can change its content and visibility, but not its address.</Alert>}
      </ContentEditor>
    </div>
  );
}
