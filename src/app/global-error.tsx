"use client";

import * as React from "react";
import Link from "next/link";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It must render its own
 * <html> and <body>, and stays dependency-free so it can never fail for the same reason.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-lavender text-ink" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <main id="main-content" className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
            <p className="text-xs font-bold tracking-[0.18em] text-orange uppercase">Something went wrong</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">The site could not be loaded</h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">An unexpected error stopped this page from rendering. Please try again in a moment.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => reset()} className="inline-flex h-12 items-center justify-center rounded-xl bg-orange px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-hover focus-visible:ring-2 focus-visible:ring-orange/50 focus-visible:outline-none">
                Try again
              </button>
              <Link href="/" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-6 text-base font-semibold text-navy transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:outline-none">
                Go to homepage
              </Link>
            </div>
            {error.digest && (
              <p className="mt-8 text-xs text-muted">
                Reference code: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{error.digest}</code>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
