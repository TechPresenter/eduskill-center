"use client";

import * as React from "react";
import Link from "next/link";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It must render its own
 * <html> and <body>, and stays dependency-free — no design-system imports, no icon package, its own
 * inline mark — so it can never fail for the same reason the page it is replacing did.
 *
 * It still uses the token utilities from globals.css, which is imported here directly. The font
 * variables are set by the root layout that just failed, so `--font-heading` will not resolve; because
 * font-family is inherited, the headings quietly fall back to the body's Inter rather than breaking.
 * It is deliberately styled to match `ErrorContent`, so the two failure screens read as one product.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-lavender text-ink" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <main id="main-content" className="flex flex-1 items-center">
          <div className="section-y container-x">
            <div className="mx-auto max-w-2xl text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-danger-light text-danger" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <path d="m10.3 3.6-8.1 14A2 2 0 0 0 4 20.5h16a2 2 0 0 0 1.7-2.9l-8.1-14a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              </span>
              <p className="eyebrow mt-6 justify-center">Something went wrong</p>
              <h1 className="text-h1 mt-3 text-navy">The site could not be loaded</h1>
              <p className="text-body-lg mt-4 text-muted">
                An unexpected error stopped this page from rendering. It is usually temporary — please try again in a moment.
              </p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="ring-focus inline-flex h-13 items-center justify-center rounded-md bg-orange px-6 text-base font-semibold text-white transition-colors duration-micro hover:bg-orange-hover motion-reduce:transition-none sm:h-12"
                >
                  Try again
                </button>
                <Link
                  href="/"
                  className="ring-focus inline-flex h-13 items-center justify-center rounded-md border border-line bg-white px-6 text-base font-semibold text-navy transition-colors duration-micro hover:bg-surface motion-reduce:transition-none sm:h-12"
                >
                  Go to homepage
                </Link>
              </div>

              {error.digest && (
                <p className="text-caption mt-10 text-muted">
                  Quote this reference if you contact us:{" "}
                  <code className="rounded-xs bg-white px-1.5 py-0.5 font-mono text-ink select-all">{error.digest}</code>
                </p>
              )}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
