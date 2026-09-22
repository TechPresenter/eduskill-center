import type { Metadata } from "next";
import { getBranding, getSetting } from "@/lib/settings";
import { getSection } from "@/lib/cms";
import { getSessionUser, portalHome } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NotFoundContent } from "@/components/site/not-found-content";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/**
 * Global 404 for unmatched URLs. It renders outside the (site) layout, so the site header
 * and footer are composed here with the same DB-driven branding.
 */
export default async function NotFound() {
  const [branding, user, footer, registrationOpen] = await Promise.all([
    getBranding(),
    getSessionUser().catch(() => null),
    getSection<{ description?: string; legalLine?: string }>("site.footer").catch(() => ({}) as { description?: string; legalLine?: string }),
    getSetting<boolean>("admissions.registrationOpen").catch(() => true),
  ]);

  return (
    <>
      <a href="#main-content" className="sr-only z-toast rounded-md bg-orange px-4 py-2 text-body-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <SiteHeader branding={branding} dashboardHref={user ? portalHome(user.role) : null} registrationOpen={registrationOpen !== false} />
      <main id="main-content" className="flex flex-1 flex-col">
        <NotFoundContent />
      </main>
      <SiteFooter branding={branding} footer={footer} />
    </>
  );
}
