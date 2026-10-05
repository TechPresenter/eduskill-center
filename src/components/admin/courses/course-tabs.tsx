import { LinkTabs } from "@/components/ui/tabs";

/**
 * The tab strip across every course screen. Kept as a component rather than a route `layout.tsx`
 * so it does not also wrap `/admin/courses/[id]/edit`, where a full-page form owns the viewport.
 */
export function CourseTabs({ courseId }: { courseId: string }) {
  const base = `/admin/courses/${courseId}`;
  return (
    <LinkTabs
      items={[
        { href: base, label: "Overview", exact: true },
        { href: `${base}/curriculum`, label: "Curriculum" },
        { href: `${base}/fees`, label: "Fees" },
        { href: `${base}/offers`, label: "Offers" },
        { href: `${base}/faqs`, label: "FAQs" },
        { href: `${base}/media`, label: "Media" },
      ]}
    />
  );
}
