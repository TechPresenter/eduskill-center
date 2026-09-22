import * as React from "react";
import { AlertCircle, Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared control styling (Input, Textarea, Select, DateInput, TagInput) — ONE height scale, one border,
 * one focus treatment.
 *
 *   height   44px on phones (`min-h-11`), 40px from `sm` — the same pair everywhere, so a filter row
 *            and a wizard field line up without per-screen tweaking.
 *   text     16px on phones so Android never zooms the viewport on focus, 14px from `sm`.
 *   radius   `md` (12px), the same shape as Button — controls read as one family.
 *   focus    navy border + a 2px navy halo. Calm enough to sit in a dense admin form and still obvious.
 *   state    `aria-invalid` → danger border, `data-valid="true"` → success border. Colour is never the
 *            only signal: `Input` also renders a state glyph, and `<Field error>` puts an icon + message
 *            under the control.
 */
export const inputClasses =
  "block w-full min-h-11 sm:min-h-10 rounded-md border border-line bg-white px-3.5 py-2.5 sm:py-2 text-base sm:text-sm text-ink placeholder:text-muted/70 transition-colors duration-micro motion-reduce:transition-none focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20 data-[valid=true]:border-success data-[valid=true]:focus:ring-success/20";

/** Native pickers paint their own control on the right edge; an auto state glyph would sit on top of it. */
const OWN_RIGHT_AFFORDANCE = new Set(["date", "datetime-local", "month", "time", "week", "color", "range", "file"]);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Red border + `aria-invalid` (pair with `<Field error>`). */
  invalid?: boolean;
  /** Green border once the value has been validated (pair with `<Field success>`). */
  valid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, valid, leftIcon, rightIcon, ...props }, ref) {
  const state = { "aria-invalid": invalid || undefined, "data-valid": valid && !invalid ? "true" : undefined } as const;

  // Validity is announced by a glyph as well as by colour (WCAG 1.4.1) — unless the caller already
  // owns the right slot, or the browser does.
  const autoGlyph =
    rightIcon || OWN_RIGHT_AFFORDANCE.has(props.type ?? "text") ? null : invalid ? (
      <AlertCircle className="h-4 w-4 text-danger" aria-hidden />
    ) : valid ? (
      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
    ) : null;
  const right = rightIcon ?? autoGlyph;

  if (!leftIcon && !right) {
    return <input ref={ref} {...state} className={cn(inputClasses, className)} {...props} />;
  }
  return (
    <div className="relative">
      {leftIcon && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{leftIcon}</span>}
      <input ref={ref} {...state} className={cn(inputClasses, leftIcon && "pl-10", right && "pr-10", className)} {...props} />
      {right && <span className={cn("absolute inset-y-0 right-3 flex items-center text-muted", autoGlyph && !rightIcon && "pointer-events-none")}>{right}</span>}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  valid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, invalid, valid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      data-valid={valid && !invalid ? "true" : undefined}
      className={cn(inputClasses, "resize-y", className)}
      {...props}
    />
  );
});

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

/** 20px box inside a 44px-tall tappable row on phones (18px box, natural height on sm+). */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className, label, description, id, ...props }, ref) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-11 sm:min-h-0 cursor-pointer gap-3 py-1.5 sm:py-0 pointer-coarse:py-2 text-sm tap-highlight-none",
        description ? "items-start" : "items-center",
        className
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          "h-5 w-5 sm:h-4.5 sm:w-4.5 shrink-0 rounded-xs border-line text-orange accent-orange ring-focus focus-visible:ring-0 focus-visible:ring-offset-0",
          description && "mt-0.5"
        )}
        {...props}
      />
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="font-medium text-ink">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});

export interface RadioGroupOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Optional leading glyph rendered in a lavender tile (e.g. a 20px lucide icon). */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export type OptionCardSize = "md" | "lg";
export type OptionCardColumns = 1 | 2 | 3 | 4;

const OPTION_COLS: Record<OptionCardColumns, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

/**
 * Shared card chrome for RadioCards / CheckboxCards. The real control is `sr-only`, so the focus ring
 * has to be carried by the card (`has-focus-visible:`) rather than by `ring-focus`.
 */
function optionCardClasses({ selected, disabled, size }: { selected: boolean; disabled?: boolean; size: OptionCardSize }) {
  return cn(
    "relative flex cursor-pointer items-start gap-3 rounded-lg border bg-white text-left transition duration-micro tap-highlight-none active:scale-[0.99] motion-reduce:transition-none",
    "has-focus-visible:ring-2 has-focus-visible:ring-orange has-focus-visible:ring-offset-2",
    size === "lg" ? "min-h-28 rounded-xl border-2 p-5" : "min-h-14 p-4",
    selected ? "border-orange bg-orange-light/60 shadow-e1" : "border-line hover:border-navy/40",
    disabled && "cursor-not-allowed opacity-50"
  );
}

function OptionCardBody({ option, selected, size }: { option: RadioGroupOption; selected: boolean; size: OptionCardSize }) {
  return (
    <>
      {option.icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md transition-colors duration-micro motion-reduce:transition-none",
            size === "lg" ? "h-11 w-11" : "h-9 w-9",
            selected ? "bg-orange text-white" : "bg-lavender text-navy"
          )}
          aria-hidden
        >
          {option.icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
        <span className={cn("font-semibold text-ink", size === "lg" ? "text-base" : "text-sm")}>{option.label}</span>
        {option.description && <span className={cn("text-muted", size === "lg" ? "text-sm" : "text-xs")}>{option.description}</span>}
      </span>
    </>
  );
}

export interface RadioCardsProps {
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: RadioGroupOption[];
  columns?: OptionCardColumns;
  /** `lg` = taller two-line cards for wizard choices (volunteer level, payment method). */
  size?: OptionCardSize;
  className?: string;
}

/** Single-select option cards; the whole card is the tap target and the selected card shows a check mark. */
export function RadioCards({ name, value, onChange, options, columns = 3, size = "md", className }: RadioCardsProps) {
  return (
    <div role="radiogroup" className={cn("grid grid-cols-1 gap-3", OPTION_COLS[columns], className)}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label key={o.value} className={optionCardClasses({ selected, disabled: o.disabled, size })}>
            <input type="radio" name={name} value={o.value} checked={selected} disabled={o.disabled} onChange={() => onChange(o.value)} className="sr-only" />
            <OptionCardBody option={o} selected={selected} size={size} />
            {selected && <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-orange" aria-hidden />}
          </label>
        );
      })}
    </div>
  );
}

export interface CheckboxCardsProps {
  name: string;
  /** Selected option values. */
  value: string[];
  onChange: (next: string[]) => void;
  options: RadioGroupOption[];
  columns?: OptionCardColumns;
  size?: OptionCardSize;
  className?: string;
}

/** Multi-select option cards (same option shape as RadioCards) with a visible check box top-right. */
export function CheckboxCards({ name, value, onChange, options, columns = 2, size = "md", className }: CheckboxCardsProps) {
  const toggle = (v: string) => (value.includes(v) ? onChange(value.filter((x) => x !== v)) : onChange([...value, v]));
  return (
    <div role="group" className={cn("grid grid-cols-1 gap-3", OPTION_COLS[columns], className)}>
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <label key={o.value} className={optionCardClasses({ selected, disabled: o.disabled, size })}>
            <input type="checkbox" name={name} value={o.value} checked={selected} disabled={o.disabled} onChange={() => toggle(o.value)} className="sr-only" />
            <OptionCardBody option={o} selected={selected} size={size} />
            <span
              className={cn(
                "absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-xs border transition-colors duration-micro motion-reduce:transition-none",
                selected ? "border-orange bg-orange text-white" : "border-line bg-white"
              )}
              aria-hidden
            >
              {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
          </label>
        );
      })}
    </div>
  );
}
