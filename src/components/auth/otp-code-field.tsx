"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pulls exactly one code out of pasted text: "123456", "123 456", "123-456", or a whole message
 * ("Your code is 123456. It expires in 10 minutes") — but never a longer number that merely contains
 * six digits, and never every digit of a sentence glued together.
 */
export function extractCode(text: string, length = 6): string | null {
  const half = Math.floor(length / 2);
  const grouped = new RegExp(`(?<!\\d)(\\d{${half}})[\\s-]?(\\d{${length - half}})(?!\\d)`);
  const match = text.match(grouped);
  if (match) return `${match[1]}${match[2]}`;
  const digits = text.replace(/\D/g, "");
  return digits.length === length ? digits : null;
}

const noopSubscribe = () => () => undefined;
/** Chrome, Edge and Safari can mask a text field with discs; elsewhere the field falls back to type=password. */
const supportsTextSecurity = () => typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("-webkit-text-security", "disc");

export interface OtpCodeFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "maxLength" | "inputMode" | "pattern" | "onPaste" | "autoComplete"> {
  /** Digits only (the field strips everything else). */
  value: string;
  onChange: (digits: string) => void;
  /**
   * Fires once each time the field becomes full — by typing, paste or autofill. Shortening the
   * value re-arms it, so a corrected code submits again but the same keystroke never submits twice.
   */
  onComplete?: (code: string) => void;
  /** Number of digits. Default 6. */
  length?: number;
  invalid?: boolean;
  /** Start with the digits visible. Default `false`: masked until the reveal toggle is pressed. */
  defaultRevealed?: boolean;
  /** Noun in the toggle's accessible label ("Show code" / "Hide code"). */
  revealNoun?: string;
}

/**
 * One-time code input: ONE numeric field rather than six boxes — one label for screen readers, one
 * target for `autocomplete="one-time-code"`, and pasting the whole code (or the whole email) just
 * works. Letter-spacing gives it the six-slot look.
 *
 * The reveal toggle is a real 48px target inside the field's right gutter (like `PasswordInput`).
 * Masking uses `-webkit-text-security` on a text input where the browser supports it, so the numeric
 * keypad and one-time-code autofill keep working; elsewhere it falls back to `type="password"`.
 *
 * Wrap it in `<Field label htmlFor error>`: Field's `id` / `aria-describedby` / `aria-invalid` are
 * forwarded to the input.
 */
export const OtpCodeField = React.forwardRef<HTMLInputElement, OtpCodeFieldProps>(function OtpCodeField(
  { value, onChange, onComplete, length = 6, invalid, defaultRevealed = false, revealNoun = "code", className, placeholder, "aria-invalid": ariaInvalid, ...props },
  ref
) {
  const [revealed, setRevealed] = React.useState(defaultRevealed);
  const cssMask = React.useSyncExternalStore(noopSubscribe, supportsTextSecurity, () => true);
  const lastCompleted = React.useRef<string | null>(null);

  // A value the parent cleared or shortened (after "resend", or a wrong code) re-arms auto-submit.
  React.useEffect(() => {
    if (value.length < length) lastCompleted.current = null;
  }, [value, length]);

  const accept = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length < length) {
      lastCompleted.current = null;
      return;
    }
    if (lastCompleted.current !== digits) {
      lastCompleted.current = digits;
      onComplete?.(digits);
    }
  };

  const masked = !revealed;
  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        type={masked && !cssMask ? "password" : "text"}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={length + 2}
        value={value}
        onChange={(e) => accept(e.target.value)}
        onPaste={(e) => {
          const code = extractCode(e.clipboardData.getData("text"), length);
          if (code) {
            e.preventDefault();
            accept(code);
          }
        }}
        placeholder={placeholder ?? "•".repeat(length)}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          inputClasses,
          // The left gutter mirrors the toggle's right gutter plus the trailing letter-spacing, so the
          // digits sit truly centred in the field.
          "min-h-14 text-center font-heading text-2xl font-bold tabular-nums sm:min-h-14 sm:text-2xl",
          "pr-12 pl-[calc(3rem+0.35em)] tracking-[0.35em] sm:pl-[calc(3rem+0.5em)] sm:tracking-[0.5em]",
          masked && cssMask && "[-webkit-text-security:disc]",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? `Hide ${revealNoun}` : `Show ${revealNoun}`}
        aria-pressed={revealed}
        aria-controls={props.id}
        disabled={props.disabled}
        className="ring-focus absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted transition-colors duration-micro hover:text-navy disabled:opacity-50 motion-reduce:transition-none"
      >
        {revealed ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
});
