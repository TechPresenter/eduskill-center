"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/feedback";
import { Button, ButtonLink } from "@/components/ui/button";
import { SetMobileHeader } from "@/components/portal/header-context";

/**
 * Route-level error boundary for every admin page. `reset()` re-renders the segment; a full refresh is
 * offered as a second step because most failures here are data/permission related.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  React.useEffect(() => {
    console.error("[admin] route error", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl py-6 lg:py-10">
      <SetMobileHeader title="Something went wrong" />
      <ErrorState
        title="Something went wrong"
        description="This page could not be loaded. Try again — if it keeps failing, the details have been logged for the Foundation team."
        onRetry={() => {
          reset();
          router.refresh();
        }}
      />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button type="button" variant="outline" size="md" onClick={() => router.refresh()} fullWidth className="sm:w-auto">
          Reload data
        </Button>
        <ButtonLink href="/admin/dashboard" variant="ghost" size="md" fullWidth className="sm:w-auto">
          Back to dashboard
        </ButtonLink>
      </div>
      {error.digest && <p className="mt-4 text-center text-xs text-muted">Reference: {error.digest}</p>}
    </div>
  );
}
