"use client";

import * as React from "react";
import { Check, Eye, EyeOff, Lock, Minus } from "lucide-react";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "@/lib/auth/password-rules";

/**
 * The one password field for the whole product — login, register, reset, and any portal/admin
 * "change password" form.
 *
 * Every password input gets a reveal toggle: on a phone, typing a strong password into an invisible
 * field is the single biggest reason people fail to sign in, and the audit found Register and Reset
 * shipping without one. The toggle is a real 44px target (it spans the full height of the 44px field
 * and is 48px wide on phones), keyboard reachable, and announces its state through its label.
 *
 * Built on `inputClasses` rather than `<Input rightIcon>` so the control can own its right gutter:
 * the shared right-icon slot is sized for a 16px glyph, not for a tap target.
 */

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Red border + `aria-invalid` (pair with `<Field error>`). */
  invalid?: boolean;
  /** Green border once the value has been validated (pair with `<Field success>`). */
  valid?: boolean;
  /** Drop the leading lock glyph in dense forms where the label already carries the meaning. */
  hideIcon?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, invalid, valid, hideIcon, ...props },
  ref
) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      {!hideIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted" aria-hidden>
          <Lock className="h-4 w-4" />
        </span>
      )}
      <input
        ref={ref}
        type={show ? "text" : "password"}
        aria-invalid={invalid || undefined}
        data-valid={valid && !invalid ? "true" : undefined}
        // The right gutter clears the toggle at both field heights (48px phone / 44px sm+).
        className={cn(inputClasses, !hideIcon && "pl-10", "pr-14 sm:pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        // The label changes rather than relying on aria-pressed alone: it reads correctly in every
        // screen reader, and it is also what the visible glyph is saying.
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className={cn(
          "absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted sm:w-11",
          "transition-colors duration-micro ring-focus hover:text-navy motion-reduce:transition-none"
        )}
      >
        {show ? <EyeOff className="h-4.5 w-4.5" aria-hidden /> : <Eye className="h-4.5 w-4.5" aria-hidden />}
      </button>
    </div>
  );
});

/* ───────────── Password rules ───────────── */

/** The server's own rule (bcrypt-free module), so the checklist and the API can never disagree. */
const RULES = PASSWORD_RULES;

/** True when the value satisfies every rule shown by `PasswordRules` (and so by the server). */
export function passwordMeetsRules(value: string): boolean {
  return RULES.every((r) => r.test(value));
}

/**
 * Inline requirement checklist for a NEW password. Designed to be passed to `<Field hint>`, which
 * renders it inside a `<p>` and wires it into the control's `aria-describedby` — hence spans with
 * list roles rather than a `<ul>`, which would be invalid there.
 *
 * State is never carried by colour alone: a met rule swaps its dash for a check mark and appends a
 * visually hidden "done".
 */
export function PasswordRules({ value, className }: { value: string; className?: string }) {
  return (
    <span role="list" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span className="text-body-sm text-muted">Needs</span>
      {RULES.map((r) => {
        const met = r.test(value);
        return (
          <span
            key={r.id}
            role="listitem"
            className={cn(
              "inline-flex items-center gap-1 text-body-sm transition-colors duration-micro motion-reduce:transition-none",
              met ? "font-medium text-success-dark" : "text-muted"
            )}
          >
            {met ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {r.label}
            {met && <span className="sr-only"> — done</span>}
          </span>
        );
      })}
    </span>
  );
}
