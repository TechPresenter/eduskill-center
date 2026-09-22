import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listFaqs } from "@/server/content";
import { PageHeader } from "@/components/ui/misc";
import { FaqManager } from "@/components/admin/content/faq-manager";

export const metadata = { title: "FAQs" };

export default async function FaqsPage() {
  const user = await requireAdmin("cms.view");
  const { items, categories } = await listFaqs();
  return (
    <div>
      <PageHeader title="FAQs" mobileTitle="FAQs" description="Questions and answers shown on the website's FAQ page. Search, filter by category and change the order here." />
      <FaqManager items={items} categories={categories} canEdit={hasPermission(user, "cms.update")} canPublish={hasPermission(user, "cms.publish")} />
    </div>
  );
}
