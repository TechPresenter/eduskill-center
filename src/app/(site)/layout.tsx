import { getBranding, getSetting } from "@/lib/settings";
import { getSection } from "@/lib/cms";
import { getSessionUser, portalHome } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PageViewTracker } from "@/components/site/page-view-tracker";
import { ChatWidget } from "@/components/site/chatbot";

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
      <a href="#main-content" className="sr-only z-toast rounded-md bg-orange px-4 py-2 text-body-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      {/*
        Safety net for the scroll reveal. It used to target `.reveal-hidden`, a class no component
        renders any more, so it guarded nothing; `Reveal` marks its host with `data-reveal` and only
        ever hides it from an effect, which no-JS never runs. Kept — now pointed at the real hook —
        so a below-the-fold section can never be left invisible.
      */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important}`}</style>
      </noscript>
      <SiteHeader branding={branding} dashboardHref={user ? portalHome(user.role) : null} registrationOpen={registrationOpen !== false} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter branding={branding} footer={footer} />
      <PageViewTracker enabled={trackVisitors === true} />
      {/*
        Public-site assistant only: the portals mount their own shells, so it never appears inside
        /student, /trainer or /admin. It hides itself when the API reports it disabled, and its name
        comes from DB branding rather than a hard-coded product name.
      */}
      <ChatWidget name={branding.shortName || branding.siteName} />
    </>
  );
}
