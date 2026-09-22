import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single panel anatomy for every auth screen: eyebrow → title → one line of orientation → body.
 *
 * Login, Register, Forgot and Reset used to each hand-roll this with their own heading size and
 * spacing, which is why the four screens never quite looked like one product. The heading is an
 * `<h1>` (it IS the page's title) rendered at the `h2` step — at this width a 32px display heading
 * shouts, and the trust these screens need comes from calm, not from scale.
 *
 * No "use client": the client forms import it and it joins their bundle, while a server page can
 * still render it directly.
 */
export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  /** `lg` widens the card to two columns of fields (Register). */
  size = "md",
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Quiet line under the card — the cross-link to the other auth screens. */
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("w-full", size === "lg" ? "max-w-xl" : "max-w-md")}>
      <div className="card card-p sm:p-8">
        <header className="mb-6">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-h2 text-navy">{title}</h1>
          {description && <p className="text-body mt-2 text-muted">{description}</p>}
        </header>
        {children}
      </div>
      {footer && <div className="text-body-sm mt-5 text-center text-muted">{footer}</div>}
    </div>
  );
}

/** Inline link used in the quiet line under the card. Orange for the primary route, navy otherwise. */
export function AuthCardLinkSeparator() {
  return (
    <span className="mx-2 text-line" aria-hidden>
      |
    </span>
  );
}
