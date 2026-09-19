import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** Rendered inside the site layout (header + footer) when a site page calls notFound(). */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
