import Link from "next/link";
import { getBranding } from "@/lib/settings";
import { BrandMark } from "@/components/brand";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="container-x flex h-16 items-center justify-between">
        <Link href="/" aria-label={`${branding.siteName} home`}>
          <BrandMark branding={branding} />
        </Link>
        <Link href="/" className="text-sm font-medium text-muted hover:text-navy">
          ← Back to website
        </Link>
      </header>
      <main className="container-x flex flex-1 items-start justify-center py-8 sm:items-center sm:py-12">{children}</main>
      <footer className="py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} {branding.siteName}. All rights reserved.
      </footer>
    </div>
  );
}
