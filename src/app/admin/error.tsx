"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { SetMobileHeader } from "@/components/portal/header-context";

/**
 * Route-level error boundary for every admin page. "Try again" re-renders the segment and refetches,
 * which is the only recovery that ever helps here — the previous screen also offered a separate
 * "Reload data" button that did the same thing, and a third link below it.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  React.useEffect(() => {
    console.error("[admin] route error", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl py-10 lg:py-16">
      <SetMobileHeader title="Something went wrong" />
      <ErrorState
        title="Something went wrong"
        description="This page could not be loaded. Try again — if it keeps failing, the details have been logged for the Foundation team."
        onRetry={() => {
          reset();
          router.refresh();
        }}
      />
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/admin/dashboard" variant="ghost" size="md">
          Back to dashboard
        </ButtonLink>
      </div>
      {error.digest && (
        <p className="mt-6 text-center text-caption text-muted">
          Reference <span className="font-mono">{error.digest}</span> — quote this if you report the problem.
        </p>
      )}
    </div>
  );
}
