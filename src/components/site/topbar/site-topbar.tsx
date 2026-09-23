import Link from "next/link";
import { getSection } from "@/lib/cms";
import { getSetting, type Branding } from "@/lib/settings";
import { SocialLinks } from "@/components/site/social-links";
import { AnnouncementMarquee, type Announcement } from "@/components/site/topbar/announcement-marquee";
import { DownloadAppButton } from "@/components/site/topbar/download-app-button";

/**
 * The strip above the site header.
 *
 * It is a SIBLING of <SiteHeader>, rendered immediately before it, and never a wrapper around it.
 * The header is `position: sticky` with `position: fixed` descendants (the phone menu, the search
 * sheet); wrapping it in anything that takes a transform, a filter or a backdrop-filter would make
 * that wrapper the containing block for those fixed layers and pin them to the header's box. Nothing
 * in this component sets a transform on an ancestor of the header — the marquee's transform lives on
 * its own inner track, which contains no fixed element.
 *
 * The strip scrolls away with the page; the header below it stays sticky, exactly as before.
 *
 * Layout: on desktop, quick links and contact details on the left, the announcements through the
 * middle, social icons and "Get the app" on the right. On phones it is only the announcements plus a
 * compact "Get the app" — quick links, contact details and social icons live in the phone menu and
 * the footer, where they have the room to be real 44px targets.
 */

export interface TopbarQuickLink {
  label?: string;
  href?: string;
}

export interface TopbarSection {
  enabled?: boolean;
  marquee?: boolean;
  announcements?: Announcement[];
  quickLinks?: TopbarQuickLink[];
}

/** `+91 98765 43210` → `tel:+919876543210`. */
function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.replace(/\D/g, "").length >= 6 ? `tel:${cleaned}` : null;
}

const LINK = "rounded-sm text-caption text-white/75 transition-colors duration-micro hover:text-white focus-visible:text-white motion-reduce:transition-none ring-focus-inverse";

function Divider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-white/20" />;
}

export async function SiteTopbar({ branding }: { branding: Branding }) {
  const [section, playStoreUrl, appStoreUrl] = await Promise.all([
    getSection<TopbarSection>("site.topbar"),
    getSetting<string>("app.playStoreUrl").catch(() => ""),
    getSetting<string>("app.appStoreUrl").catch(() => ""),
  ]);

  if (section.enabled === false) return null;

  const announcements = (section.announcements ?? []).filter((a): a is Announcement => !!a && typeof a.text === "string" && a.text.trim() !== "");
  const quickLinks = (section.quickLinks ?? []).filter((l) => !!l?.label?.trim() && !!l?.href?.trim());
  const phone = branding.contact.phone.trim();
  const email = branding.contact.email.trim();
  const hours = branding.contact.hours.trim();
  const tel = phone ? telHref(phone) : null;

  // Nothing to say and nothing to offer — do not render an empty band.
  if (announcements.length === 0 && quickLinks.length === 0 && !phone && !email) return null;

  return (
    <div
      className={[
        "relative bg-navy-dark text-white",
        // Desktop only. Below lg this strip carries nothing but the marquee — the quick links,
        // contact details and social icons all start at lg — and on a 360px phone that marquee is a
        // sentence clipped at both edges next to a pause button. Phones are already in app-shell mode
        // (bottom tab bar), where a website announcement band above the app bar is the wrong chrome.
        // Nothing is lost: the announcements repeat on the homepage, and the contact details, quick
        // links and social icons are all in the footer at every width.
        "max-lg:hidden",
        // Installed as an app, this strip is noise: the marquee, the store link and the quick links
        // all belong to the website. Hiding it here also keeps the safe-area inset a matter for the
        // header alone, which is the element that owns `pt-safe`.
        "[@media(display-mode:standalone)]:hidden",
      ].join(" ")}
    >
      <div className="mx-auto flex h-10 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:gap-4 lg:px-8">
        {/*
          LEFT — quick links and contact. Desktop only; phones get these in the menu and footer.

          Each piece appears at the width where it can afford to, because the announcements in the
          middle are the point of this strip and must never be squeezed down to a word and a half:
          quick links from lg, the phone number from xl, the email from 2xl and the office hours only
          on a genuinely wide screen. All of them are in the footer at every width.
        */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {quickLinks.length > 0 && (
            <nav aria-label="Quick links">
              <ul className="flex items-center gap-3">
                {quickLinks.map((l) => (
                  <li key={`${l.href}-${l.label}`}>
                    <Link href={l.href!} className={`${LINK} inline-flex h-10 items-center`}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {quickLinks.length > 0 && tel && <span className="hidden xl:block"><Divider /></span>}

          <div className="hidden items-center gap-3 xl:flex">
            {tel && (
              <a href={tel} className={`${LINK} hidden h-10 items-center xl:inline-flex`}>
                {phone}
              </a>
            )}
            {tel && email && <span className="hidden 2xl:block"><Divider /></span>}
            {email && (
              <a href={`mailto:${email}`} className={`${LINK} hidden h-10 items-center 2xl:inline-flex`}>
                {email}
              </a>
            )}
            {hours && (email || tel) && <span className="hidden min-[1800px]:block"><Divider /></span>}
            {hours && <span className="hidden text-caption text-white/60 min-[1800px]:inline">{hours}</span>}
          </div>
        </div>

        {/* CENTRE — the announcements. Takes whatever width is left. */}
        {announcements.length > 0 ? (
          <AnnouncementMarquee items={announcements} scroll={section.marquee !== false} />
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        {/* RIGHT — social, then the app pill. */}
        <div className="flex shrink-0 items-center gap-3">
          <SocialLinks social={branding.social} whatsapp={branding.contact.whatsapp} siteName={branding.siteName} size="sm" className="hidden xl:flex" />
          <DownloadAppButton playStoreUrl={playStoreUrl} appStoreUrl={appStoreUrl} appName={branding.shortName || branding.siteName} />
        </div>
      </div>
    </div>
  );
}
