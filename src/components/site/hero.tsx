import { MessageCircle, Phone } from "lucide-react";
import { Blob, GlowOrb, SectionBg } from "@/components/site/decor";
import { HeroEnquiryForm, type HeroChipData } from "@/components/site/hero-enquiry-form";
import { HeroSlider, type HeroSlideData } from "@/components/site/hero-slider";
import type { CourseOption } from "@/components/site/course-select";


export interface HeroSection {
  eyebrow?: string;
  title: string;
  /** Optional short title for phones (≤ 2 lines). Falls back to the first line of `title`. */
  mobileTitle?: string;
  subtitle?: string;
  pillText?: string;
  emphasis?: string;
  programLine?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  tertiaryLabel?: string;
  tertiaryHref?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Enquiry card. */
  formHeading?: string;
  formCtaLabel?: string;
  formNote?: string;
  consentText?: string;
  chips?: HeroChipData[];
  /** Extra slides added in Admin → CMS. Empty means the hero renders as a single static banner. */
  slides?: HeroSlideData[];
}

/**
 * The homepage hero.
 *
 * LAYOUT. Three parts on one dark band, after the reference the Foundation asked for: editorial copy
 * on the left (headline → pill → offer line → programme line → CTA), the cut-out subject in the
 * middle, and a working admission-enquiry card on the right. Below lg it is a single column —
 * copy then the card, so the form is the first thing under the headline rather than the last
 * thing on a long page.
 *
 * WHAT REPLACED WHAT. The right-hand column used to hold `HeroFinderCard` ("Find a Training
 * Center"); it now holds the enquiry form, and only one of the two is ever rendered. Finding a
 * centre is still on this page — `home.centerSearch` further down owns that job, with the full
 * state/district/block cascade the hero never had room for.
 *
 * HONESTY. The hero states no figures at all now — the impact numbers live in the dedicated band
 * to positive values by `getImpactStats`), and the stat strip renders nothing at all when there is
 * nothing true to show. No learner counts, no discounts, no accreditations.
 */

/**
 * The dark bed: navy-dark, a faint line grid, one huge soft orange shape bleeding off the left edge,
 * and a cool glow on the right. All four come from the shared decor system rather than one-off CSS,
 * so a repaint of the palette reaches the hero too.
 *
 * Contrast budget: white on navy-dark is 13.21:1 undecorated. The orange blob's densest composite
 * over it is ~#524140, where white still measures 10.0:1 and the on-navy orange accent 5.4:1, so no
 * piece of copy in the hero depends on the art staying where it is.
 */
function HeroBackdrop() {
  return (
    <>
      <SectionBg variant="grid" tone="navy" className="opacity-70" />
      <Blob tone="orange" shape={2} size="xl" opacity={0.34} className="top-[-12%] left-[-22%] h-168 w-168 blur-3xl sm:h-208 sm:w-208" />
      <GlowOrb tone="navy-light" size="xl" className="-right-24 bottom-[-18%]" />
    </>
  );
}

/**
 * The reference's white accreditation card, in our terms: three checkable claims about this
 * Foundation. A 3-up grid at every width — hairline-divided columns inside one white card from sm,
 * and the same three columns without the dividers on a phone, where 108px each is enough for a mark
 * and a short line but not for a rule between them.
 */

/**
 * `null` for anything that is not a real Indian mobile we could actually connect a visitor to.
 *
 * The seeded default for `contact.phone` is the placeholder "+91 00000 00000", so "is the setting
 * non-empty" is the wrong question — a button that dials ten zeros is worse than no button. Ten
 * identical digits and anything outside the 6–9 prefix are treated as not configured.
 */
function usableMobile(raw: string | undefined | null): { tel: string; wa: string } | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const local = digits.slice(-10);
  if (/^(\d)\1{9}$/.test(local) || !/^[6-9]\d{9}$/.test(local)) return null;
  return { tel: `+91${local}`, wa: `91${local}` };
}

/**
 * The reference's floating right-edge call / WhatsApp tabs.
 *
 * Only shown from 1400px, and that number is not arbitrary: `container-x` caps at 1280, so 1400 is
 * the first width where the viewport gutter (60px) can hold a 44px rail without touching the
 * enquiry card. Below that the same two numbers are already one tap away in the topbar and footer.
 *
 * It is a SIBLING of the hero section, not a child: the section sets `overflow-x-clip` and the
 * backdrop uses `blur-3xl`, and a `position: fixed` element inside either would be clipped or
 * re-parented. Each button renders only if its setting holds a number we can really dial.
 */
function HeroContactRail({ phone, whatsapp }: { phone?: string; whatsapp?: string }) {
  const tel = usableMobile(phone);
  const wa = usableMobile(whatsapp);
  if (!tel && !wa) return null;
  return (
    <div className="fixed top-1/2 right-3 z-sticky hidden -translate-y-1/2 flex-col items-end gap-2 min-[1400px]:flex">
      {tel && (
        <a
          href={`tel:${tel.tel}`}
          aria-label={`Call ${tel.tel}`}
          className="ring-focus grid h-12 w-12 place-items-center rounded-full bg-orange text-white shadow-e3 transition-colors duration-micro hover:bg-orange-hover motion-reduce:transition-none"
        >
          <Phone className="h-5 w-5" aria-hidden />
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa.wa}`}
          target="_blank"
          rel="noopener noreferrer"
          // btn-fill-green is the project's answer to "white label on flat green": see globals.css.
          className="ring-focus flex h-12 items-center gap-2 rounded-full bg-green px-4 text-body-sm font-bold text-white shadow-e3 transition-colors duration-micro hover:bg-green-dark motion-reduce:transition-none"
        >
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
          Chat
        </a>
      )}
    </div>
  );
}

export function Hero({
  section,
  courses,
  contact,
}: {
  section: HeroSection;
  /** Active courses for the enquiry card's select. Server-loaded: no fetch on first paint. */
  courses: CourseOption[];
  contact?: { phone?: string; whatsapp?: string };
}) {
  // `getImpactStats` already drops anything null, non-finite or ≤ 0, so an absent or zero statistic
  // never reaches the strip — it simply has fewer entries, or none, and then renders nothing.

  const form = (
    <HeroEnquiryForm
      heading={section.formHeading || "Enquire about admission"}
      consentText={section.consentText || "I authorise EduSkill India Foundation to contact me about admission on the number I have given."}
      ctaLabel={section.formCtaLabel || "Send enquiry"}
      note={section.formNote}
      courses={courses}
    />
  );

  // The first slide IS the section's own flat fields, so existing CMS content keeps rendering
  // exactly as before and a Foundation editor only sees a slideshow once they add a second slide in
  // Admin → CMS. With one slide the slider drops its carousel semantics, dots and autoplay
  // entirely (see `HeroSlider`), which is the "single static banner" this hero has always been.
  const slides: HeroSlideData[] = [
    {
      eyebrow: section.eyebrow,
      title: section.title,
      mobileTitle: section.mobileTitle,
      subtitle: section.subtitle,
      pillText: section.pillText,
      emphasis: section.emphasis,
      programLine: section.programLine,
      primaryLabel: section.primaryLabel,
      primaryHref: section.primaryHref,
      secondaryLabel: section.secondaryLabel,
      secondaryHref: section.secondaryHref,
      tertiaryLabel: section.tertiaryLabel,
      tertiaryHref: section.tertiaryHref,
      imageUrl: section.imageUrl,
      imageAlt: section.imageAlt,
    },
    ...(section.slides ?? []).filter((s) => s && s.title?.trim()),
  ];

  return (
    <>
      {/*
        `overflow-x-clip`, never `overflow-hidden`: the blob and the figure are meant to overhang,
        and `overflow-hidden` would also clip them vertically — which is what bit this hero before.
      */}
      <section className="relative overflow-x-clip bg-navy-dark text-white">
        <HeroBackdrop />
        <HeroSlider slides={slides} form={form} />
      </section>
      <HeroContactRail phone={contact?.phone} whatsapp={contact?.whatsapp} />
    </>
  );
}
