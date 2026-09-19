import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { cmsPickerOptions, listStories } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { StoriesManager } from "@/components/admin/cms/stories-manager";

export const metadata = { title: "Success Stories" };

export default async function CmsStoriesPage() {
  const user = await requireAdmin("cms.view");
  const [items, options] = await Promise.all([listStories(), cmsPickerOptions()]);
  return (
    <div>
      <PageHeader title="Success stories" mobileTitle="Stories" backHref="/admin/cms" description="Stories of students who completed training. Featured stories appear on the homepage." />
      <StoriesManager items={items} courses={options.courses} centers={options.centers} canEdit={hasPermission(user, "cms.update")} canPublish={hasPermission(user, "cms.publish")} />
    </div>
  );
}
