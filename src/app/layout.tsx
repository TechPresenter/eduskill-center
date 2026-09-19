import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { RegisterSW } from "@/components/pwa/register-sw";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { getPublicSettings } from "@/lib/settings";
import { appUrl } from "@/lib/utils";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSettings().catch(() => ({}) as Record<string, unknown>);
  const siteName = String(s["branding.siteName"] ?? "EduSkill India Foundation");
  const title = String(s["seo.defaultTitle"] ?? siteName);
  const description = String(s["seo.defaultDescription"] ?? "");
  const ogImage = String(s["seo.ogImage"] ?? "");
  const favicon = String(s["branding.faviconUrl"] ?? "");
  return {
    metadataBase: new URL(appUrl()),
    title: { default: title, template: `%s | ${siteName}` },
    description,
    applicationName: siteName,
    keywords: String(s["seo.keywords"] ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: String(s["branding.shortName"] ?? "EduSkill") },
    formatDetection: { telephone: true },
    icons: favicon ? { icon: favicon } : undefined,
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      locale: "en_IN",
    },
    twitter: { card: "summary_large_image", title, description, images: ogImage ? [ogImage] : undefined },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#12357A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
        <RegisterSW />
        <InstallPrompt />
      </body>
    </html>
  );
}
