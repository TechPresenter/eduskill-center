import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { CentreDeclaration } from "@/components/site/terms-declarations";
import { TermsPageView, termsPageMetadata } from "@/components/site/terms-page";

export function generateMetadata(): Promise<Metadata> {
  return termsPageMetadata("centreInCharge");
}

export const dynamic = "force-dynamic";

/** The Centre In-charge Terms & Conditions, accepted on the first step of /open-a-centre/apply. */
export default async function CentreTermsPage() {
  const open = await getSetting<boolean>("centres.applicationsOpen").catch(() => true);
  return (
    <TermsPageView
      termsKey="centreInCharge"
      eyebrow="Open a Centre"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Open a Centre", href: "/open-a-centre" }, { label: "Terms & Conditions" }]}
      declaration={<CentreDeclaration blank headingLevel={2} />}
      cta={
        open !== false
          ? { href: "/open-a-centre/apply", label: "Apply to open a centre", note: "You accept these terms on the first step of the application, before the form opens." }
          : null
      }
    />
  );
}
