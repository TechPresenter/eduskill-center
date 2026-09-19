"use client";

import { ErrorContent } from "@/components/site/error-content";

/** Root error boundary – catches errors thrown below the root layout (any route group). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <ErrorContent error={error} reset={reset} />
    </main>
  );
}
