import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/site/cms-page";

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("refund-policy", "/refund-policy", "Refund Policy");
}

export default function RefundPolicyPage() {
  return <CmsPageView slug="refund-policy" eyebrow="Legal" fallbackTitle="Refund Policy" />;
}
