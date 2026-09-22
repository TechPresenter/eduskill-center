import Link from "next/link";
import { ArrowLeft, GraduationCap, MapPin, UserPlus } from "lucide-react";
import { getBranding, type Branding } from "@/lib/settings";
import { BrandMark } from "@/components/brand";
import { SectionBg } from "@/components/site/decor";

/**
 * Auth shell. On a phone this is deliberately one calm column — brand, one card, nothing else to
 * read or wait for. From `lg` a navy panel appears alongside it carrying the brand and what the
 * account is actually for, so signing in feels like entering the Foundation rather than hitting a
 * lone form on a grey field.
 *
 * The panel is inline SVG and CSS gradients only (see `SectionBg`): no image request, no client JS,
 * no blur — and it is `hidden` below `lg`, so the phone pays nothing for it beyond a little markup.
 */

/** What the account is for. Every line describes a feature this platform actually ships. */
const STEPS = [
  {
    icon: UserPlus,
    title: "One account, one login",
    body: "Students, volunteer trainers and Foundation staff all sign in here.",
  },
  {
    icon: MapPin,
    title: "Apply at a centre near you",
    body: "Pick a course and a training centre in your own block or district.",
  },
  {
    icon: GraduationCap,
    title: "Follow your whole journey",
    body: "Application status, batch schedule, attendance and certificates in one place.",
  },
];

function AuthAside({ branding }: { branding: Branding }) {
  return (
    // `isolate` keeps the decorative wash in its own stacking context; `overflow-hidden` guarantees
    // it can never widen the document.
    <aside className="relative isolate hidden overflow-hidden bg-linear-to-br from-navy to-navy-dark text-white lg:flex lg:flex-col">
      <SectionBg variant="mesh" tone="navy" className="opacity-80" />
      <div className="relative z-10 flex flex-1 flex-col justify-between gap-12 px-10 py-12 xl:px-14">
        <Link href="/" aria-label={`${branding.siteName} home`} className="ring-focus-inverse inline-flex min-h-11 w-fit items-center rounded-md">
          <BrandMark branding={branding} light />
        </Link>

        <div className="max-w-md">
          <h2 className="text-h1 text-white">Skills that open the next door.</h2>
          <p className="text-body-lg mt-4 text-white/75">
            Your account is how you apply, learn and prove what you have learned — from the first form to the certificate.
          </p>

          <ul className="mt-10 space-y-6">
            {STEPS.map((s) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-white ring-1 ring-white/15 ring-inset" aria-hidden>
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-h4 block text-white">{s.title}</span>
                  <span className="text-body-sm mt-1 block text-white/70">{s.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-caption text-white/55">
          © {new Date().getFullYear()} {branding.siteName}
        </p>
      </div>
    </aside>
  );
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <AuthAside branding={branding} />

      <div className="flex flex-1 flex-col bg-surface">
        <header className="container-x flex h-16 shrink-0 items-center justify-between gap-3 lg:h-20 lg:justify-end">
          {/* The brand is already in the navy panel from `lg` up, so it is dropped rather than doubled. */}
          <Link href="/" aria-label={`${branding.siteName} home`} className="ring-focus inline-flex min-h-11 min-w-0 shrink items-center overflow-x-clip rounded-md lg:hidden">
            <BrandMark branding={branding} />
          </Link>
          {/*
           * `shrink-0 whitespace-nowrap`: this is the row that has bitten us before at 360px. An
           * uploaded logo can be arbitrarily wide, so the brand yields and the back link never wraps
           * into a second line inside its 44px box.
           */}
          <Link
            href="/"
            className="text-body-sm ring-focus -mr-2 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium whitespace-nowrap text-muted transition-colors duration-micro hover:text-navy motion-reduce:transition-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to website
          </Link>
        </header>

        <main id="main-content" className="container-x flex flex-1 items-start justify-center py-6 sm:items-center sm:py-12">
          {children}
        </main>

        <footer className="text-caption container-x shrink-0 py-6 text-center text-muted lg:hidden">
          © {new Date().getFullYear()} {branding.siteName}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
