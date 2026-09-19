"use client";

import * as React from "react";
import { AlertTriangle, Home, MessageCircle, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Body of the runtime error boundary. Client-only (error boundaries must be client
 * components), so it never touches the database – branding here is deliberately generic.
 */
export function ErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex flex-1 items-center bg-lavender" aria-labelledby="error-title">
      <div className="container-x py-16 text-center sm:py-24">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-light text-danger">
          <AlertTriangle className="h-8 w-8" aria-hidden />
        </span>
        <p className="eyebrow mt-6 justify-center">Something went wrong</p>
        <h1 id="error-title" className="section-title mt-3">
          We hit an unexpected problem
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">The page could not be loaded. Please try again – if the problem continues, let us know and we will fix it.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <p className="mt-8 text-xs text-muted">
            Reference code: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink">{error.digest}</code>
          </p>
        )}
      </div>
    </section>
  );
}
