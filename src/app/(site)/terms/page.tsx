import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/site/cms-page";

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("terms", "/terms", "Terms & Conditions");
}

export default function TermsPage() {
  return <CmsPageView slug="terms" eyebrow="Legal" fallbackTitle="Terms & Conditions" />;
}
