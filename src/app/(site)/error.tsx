"use client";

import { ErrorContent } from "@/components/site/error-content";

/** Error boundary for public site pages – keeps the site header and footer visible. */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent error={error} reset={reset} />;
}
