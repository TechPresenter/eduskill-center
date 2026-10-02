import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBranding, type Branding } from "@/lib/settings";
import { BrandMark } from "@/components/brand";
import { SectionBg } from "@/components/site/decor";
import { AuthAsideCopy } from "@/components/auth/auth-aside-copy";

/**
 * Auth shell. On a phone this is deliberately one calm column — brand, one card, nothing else to
 * read or wait for. From `lg` a navy panel appears alongside it carrying the brand and what the
 * account is actually for, so signing in feels like entering the Foundation rather than hitting a
 * lone form on a grey field.
 *
 * The panel is inline SVG and CSS gradients only (see `SectionBg`): no image request, no blur — and
 * it is `hidden` below `lg`, so the phone pays nothing for it beyond a little markup. Its words come
 * from `AuthAsideCopy`, the one small client piece: Secure Admin Login (/login/admin) gets its own
 * copy, every other auth screen keeps the public one.
 */

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

        <AuthAsideCopy />

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
