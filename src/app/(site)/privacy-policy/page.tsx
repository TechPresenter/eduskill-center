import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/site/cms-page";

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("privacy-policy", "/privacy-policy", "Privacy Policy");
}

export default function PrivacyPolicyPage() {
  return <CmsPageView slug="privacy-policy" eyebrow="Legal" fallbackTitle="Privacy Policy" />;
}
