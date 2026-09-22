"use client";

import * as React from "react";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

/**
 * Error boundary for every trainer screen, mirroring the student portal's. The shell (app bar, drawer,
 * bottom nav) belongs to the layout and survives, so a failed screen still leaves the trainer somewhere
 * they can navigate from. Retry comes first: on a patchy mobile network a dropped request is by far the
 * likeliest cause.
 */
export default function TrainerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Trainer portal error:", error);
  }, [error]);

  return (
    <>
      <SetMobileHeader title="Something went wrong" />
      <h1 className="sr-only">Something went wrong</h1>
      <ErrorState title="This page could not load" description="The connection may have dropped. Try again — if it keeps happening, contact the Foundation office." onRetry={reset} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink href="/trainer/dashboard" variant="outline">
          Back to home
        </ButtonLink>
        <ButtonLink href="/trainer/notifications" variant="ghost">
          Open my inbox
        </ButtonLink>
      </div>
      {error.digest && <p className="mt-4 text-center font-mono text-caption text-muted">Reference: {error.digest}</p>}
    </>
  );
}
