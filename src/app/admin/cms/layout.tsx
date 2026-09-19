import { requireAdmin } from "@/lib/auth/guards";
import { LinkTabs } from "@/components/ui/tabs";

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("cms.view");
  return (
    <div>
      <LinkTabs
        className="mb-6"
        items={[
          { href: "/admin/cms", label: "Overview", exact: true },
          { href: "/admin/cms/sections", label: "Website sections" },
          { href: "/admin/cms/pages", label: "Pages" },
          { href: "/admin/cms/programs", label: "Programs" },
          { href: "/admin/cms/stories", label: "Success stories" },
          { href: "/admin/cms/partners", label: "Partners" },
        ]}
      />
      {children}
    </div>
  );
}
