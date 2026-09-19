import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/site/cms-page";

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("disclaimer", "/disclaimer", "Disclaimer");
}

export default function DisclaimerPage() {
  return <CmsPageView slug="disclaimer" eyebrow="Legal" fallbackTitle="Disclaimer" />;
}
