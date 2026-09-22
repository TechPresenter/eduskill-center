"use client";

import * as React from "react";
import { AlertTriangle, Home, MessageCircle, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Body of the runtime error boundary. Client-only (error boundaries must be client components), so it
 * never touches the database — branding here is deliberately generic and it pulls in nothing heavier
 * than the button primitives.
 *
 * The tone is "here is what to do next", not "sorry". Retrying is the primary action because a failed
 * render is very often transient; the reference code sits at the bottom, where it matters only to the
 * person reporting the problem.
 */
export function ErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="section-y flex flex-1 items-center bg-lavender" aria-labelledby="error-title">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-danger-light text-danger" aria-hidden>
            <AlertTriangle className="h-8 w-8" />
          </span>
          <p className="eyebrow mt-6 justify-center">Something went wrong</p>
          <h1 id="error-title" className="text-h1 mt-3 text-navy">
            We hit an unexpected problem
          </h1>
          <p className="text-body-lg mt-4 text-muted">
            This page could not be loaded. It is usually temporary — try once more, and if it keeps happening, tell us and we will fix it.
          </p>

          {/* Full-width stacked targets on a phone; one row from sm up, retry first. */}
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={() => reset()} leftIcon={<RotateCcw className="h-4 w-4" />}>
              Try again
            </Button>
            <ButtonLink href="/" size="lg" variant="outline" leftIcon={<Home className="h-4 w-4" />}>
              Go to homepage
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="ghost" leftIcon={<MessageCircle className="h-4 w-4" />}>
              Report the problem
            </ButtonLink>
          </div>

          {error.digest && (
            <p className="text-caption mt-10 text-muted">
              Quote this reference if you contact us:{" "}
              <code className="rounded-xs bg-white px-1.5 py-0.5 font-mono text-ink select-all">{error.digest}</code>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
