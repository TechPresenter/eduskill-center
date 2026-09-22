import { BrandMark } from "@/components/brand";
import { HeaderClient, type NavItem } from "@/components/site/header-client";
import { getCoursesMenu } from "@/server/nav-menu";
import type { Branding } from "@/lib/settings";

export const SITE_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Programs", href: "/programs" },
  { label: "Courses", href: "/courses" },
  { label: "Training Centers", href: "/training-centers" },
  { label: "Become a Trainer", href: "/become-a-trainer" },
  { label: "Open a Centre", href: "/open-a-centre" },
  { label: "Scholarship", href: "/scholarship" },
  { label: "Success Stories", href: "/success-stories" },
  { label: "Contact", href: "/contact" },
];

export async function SiteHeader({ branding, dashboardHref, registrationOpen }: { branding: Branding; dashboardHref: string | null; registrationOpen: boolean }) {
  // Never throws (cached 60s, per-request memoised); the header falls back to plain links without it.
  const coursesMenu = await getCoursesMenu();
  return (
    <HeaderClient
      nav={SITE_NAV}
      siteName={branding.siteName}
      logo={<BrandMark branding={branding} />}
      logoMobile={<BrandMark branding={branding} variant="mobile" />}
      dashboardHref={dashboardHref}
      registrationOpen={registrationOpen}
      coursesMenu={coursesMenu}
    />
  );
}
