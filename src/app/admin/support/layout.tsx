import { requireAdmin } from "@/lib/auth/guards";
import { LinkTabs } from "@/components/ui/tabs";

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("support.view");
  return (
    <div>
      <LinkTabs
        className="mb-6"
        items={[
          { href: "/admin/support/tickets", label: "Support tickets" },
          { href: "/admin/support/enquiries", label: "Website enquiries" },
        ]}
      />
      {children}
    </div>
  );
}
