import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { termsKeyForSlug, type TermsKey } from "@/lib/terms/documents";
import { getCmsPage } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { cmsPageFields } from "../fields";

export const metadata = { title: "Edit Page" };

/** Who must accept each terms page before applying. */
const TERMS_AUDIENCE: Record<TermsKey, string> = {
  centreInCharge: "Everyone who applies to open a centre must",
  volunteerTeacher: "Everyone who applies as a volunteer trainer or teacher must",
  inCharge: "Block and District level volunteer trainer applicants must",
};

export default async function EditCmsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("cms.view");
  const { id } = await params;
  const page = await getCmsPage(id).catch(() => null);
  if (!page) notFound();
  const canEdit = hasPermission(user, "cms.update");
  const canPublish = hasPermission(user, "cms.publish");
  // A Terms & Conditions page that applicants accept: a Draft falls back to the built-in text rather than hiding it.
  const termsKey = termsKeyForSlug(page.slug);
  const isTermsPage = termsKey !== null;

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
        description={<span className="font-mono">{page.publicPath}</span>}
      />
      <ContentEditor
        publicPrefix=""
        publicPath={page.isFixed ? page.publicPath : undefined}
        endpoint="/api/admin/cms/pages"
        id={page.id}
        itemLabel="page"
        backHref="/admin/cms/pages"
        canEdit={canEdit}
        deleteLocked={
          isTermsPage
            ? "This page cannot be deleted – applicants must always have terms to accept."
            : page.isFixed
              ? "System pages cannot be deleted – set the status to Draft to hide them."
              : null
        }
        fields={cmsPageFields({
          fixed: page.isFixed,
          canPublish,
          draftHint: isTermsPage ? "While this page is a Draft, applicants are shown the built-in terms instead." : undefined,
        })}
        initial={{ title: page.title, slug: page.slug, status: page.status, excerpt: page.excerpt ?? "", content: page.content, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "" }}
        meta={`Last saved ${formatDateTime(page.updatedAt)}`}
      >
        {termsKey ? (
          <Alert tone="info" title="Applicants must accept this page before they apply">
            {TERMS_AUDIENCE[termsKey]} read this text and tick to accept it before they can apply. Changing the title or text makes it a new version: anyone with the form
            already open is asked to accept the new text, and earlier applicants keep the exact text they accepted. While this page is a Draft, the built-in text is shown instead.
          </Alert>
        ) : (
          page.isFixed && <Alert tone="info">This page is linked from the website navigation. You can change its content and visibility, but not its address.</Alert>
        )}
      </ContentEditor>
    </div>
  );
}
