import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * The card is the product's one surface: `rounded-card` (16), a 1px `line` border, white, and e1 —
 * the single resting elevation. `hover` adds the e2 lift, but only on a real pointer (touch gets a
 * press instead). Both live in globals.css as `card` / `card-hover` so nothing here can drift.
 *
 * NOTE: `card-hover` applies a transform on hover, which makes the card a containing block for any
 * `position: fixed` descendant. Never put a Fab or StickyActionBar inside one.
 */
export function Card({ className, hover, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn("card", hover && "card-hover", className)} {...props} />;
}

export function CardHeader({ className, title, description, action, ...props }: React.HTMLAttributes<HTMLDivElement> & { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between", className)} {...props}>
      <div className="min-w-0">
        {title && <h3 className="text-h4 text-navy">{title}</h3>}
        {description && <p className="text-body-sm mt-1 text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/*
 * Padding stays the literal `p-5` (not the `card-p` utility) on purpose: tailwind-merge cannot see a
 * conflict between a custom utility and a caller's `p-0` / `p-8`, and several pages override it.
 */
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 border-t border-line px-5 py-4", className)} {...props} />;
}
