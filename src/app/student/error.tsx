"use client";

import * as React from "react";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

/**
 * Error boundary for every student screen. The portal shell (app bar, drawer, bottom nav) is owned by
 * the layout and survives, so a failed page still leaves the student somewhere they can navigate from
 * instead of on a bare error page.
 *
 * `reset()` re-renders the segment, which is the right first move for a transient failure (a dropped
 * connection on a patchy mobile network is by far the most likely cause here); support is offered as
 * the second step because a student cannot act on a stack trace.
 */
export default function StudentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    // Surfaced in the browser console only; the server already logs the real error with its digest.
    console.error("Student portal error:", error);
  }, [error]);

  return (
    <>
      <SetMobileHeader title="Something went wrong" />
      <h1 className="sr-only">Something went wrong</h1>
      <ErrorState
        title="This page could not load"
        description="The connection may have dropped. Try again — if it keeps happening, our team can help."
        onRetry={reset}
      />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink href="/student/dashboard" variant="outline">
          Back to dashboard
        </ButtonLink>
        <ButtonLink href="/student/support" variant="ghost">
          Contact support
        </ButtonLink>
      </div>
      {error.digest && <p className="text-caption mt-4 text-center font-mono text-muted">Reference: {error.digest}</p>}
    </>
  );
}
