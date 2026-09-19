import { getBranding, getSetting } from "@/lib/settings";
import { getSection } from "@/lib/cms";
import { getSessionUser, portalHome } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PageViewTracker } from "@/components/site/page-view-tracker";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [branding, user, footer, trackVisitors, registrationOpen] = await Promise.all([
    getBranding(),
    getSessionUser().catch(() => null),
    getSection<{ description?: string; legalLine?: string }>("site.footer"),
    getSetting<boolean>("analytics.trackVisitors").catch(() => false),
    getSetting<boolean>("admissions.registrationOpen").catch(() => true),
  ]);

  return (
    <>
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <noscript>
        <style>{`.reveal-hidden{opacity:1!important}`}</style>
      </noscript>
      <SiteHeader branding={branding} dashboardHref={user ? portalHome(user.role) : null} registrationOpen={registrationOpen !== false} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter branding={branding} footer={footer} />
      <PageViewTracker enabled={trackVisitors === true} />
    </>
  );
}
