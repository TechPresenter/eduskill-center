import * as React from "react";
import { AlertCircle, CalendarDays } from "lucide-react";
import { cn, dateInputValue } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";
import { Field } from "@/components/ui/form";

type DateLike = string | Date | null | undefined;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Normalises a Date / ISO string / yyyy-MM-dd into the `yyyy-MM-dd` form a native date input needs. */
export function toDateInputValue(value: DateLike): string | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return "";
  if (typeof value === "string" && ISO_DAY.test(value)) return value;
  return dateInputValue(value);
}

export interface DateInputProps extends Omit<InputProps, "type" | "value" | "defaultValue" | "min" | "max" | "leftIcon"> {
  /** Accepts a Date, an ISO timestamp or `yyyy-MM-dd`; normalised for the native control. */
  value?: DateLike;
  defaultValue?: DateLike;
  min?: DateLike;
  max?: DateLike;
}

/**
 * Native `type="date"` (system picker on Android/iOS, inline calendar on desktop) with a calendar glyph,
 * the shared Input styling and the same 44/40px height as every other control. Supports `invalid` / `valid`
 * like Input; the browser owns the right edge here, so validity is signalled by the border plus the
 * `<Field error>` message rather than an inline glyph.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput({ value, defaultValue, min, max, className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="date"
      value={toDateInputValue(value)}
      defaultValue={toDateInputValue(defaultValue)}
      min={toDateInputValue(min) || undefined}
      max={toDateInputValue(max) || undefined}
      leftIcon={<CalendarDays className="h-4 w-4" aria-hidden />}
      className={cn("appearance-none", className)}
      {...props}
    />
  );
});

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface DateRangeInputProps {
  from: DateLike;
  to: DateLike;
  onChange: (next: DateRangeValue) => void;
  /** Field labels; default "From" / "To". */
  labels?: { from?: React.ReactNode; to?: React.ReactNode };
  /** Input `name`s for uncontrolled form submission (default `from` / `to`). */
  names?: { from?: string; to?: string };
  min?: DateLike;
  max?: DateLike;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Error shown under the pair (e.g. "End date must be after start date"). */
  error?: React.ReactNode;
  className?: string;
}

/**
 * Two DateInputs (stacked on phones, side by side from sm) that keep `to ≥ from`. A range error belongs
 * to the pair rather than to either field, so it is rendered once underneath and both inputs point at it
 * with `aria-describedby` — same wording, size and icon as every other `<Field error>`.
 */
export function DateRangeInput({ from, to, onChange, labels, names, min, max, required, disabled, invalid, error, className }: DateRangeInputProps) {
  const reactId = React.useId();
  const errorId = error ? `${reactId}-range-error` : undefined;
  const fromValue = toDateInputValue(from) ?? "";
  const toValue = toDateInputValue(to) ?? "";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={labels?.from ?? "From"} required={required}>
          <DateInput
            name={names?.from ?? "from"}
            value={fromValue}
            min={min}
            max={toValue || max}
            required={required}
            disabled={disabled}
            invalid={invalid}
            aria-describedby={errorId}
            onChange={(e) => onChange({ from: e.target.value, to: toValue })}
          />
        </Field>
        <Field label={labels?.to ?? "To"} required={required}>
          <DateInput
            name={names?.to ?? "to"}
            value={toValue}
            min={fromValue || min}
            max={max}
            required={required}
            disabled={disabled}
            invalid={invalid}
            aria-describedby={errorId}
            onChange={(e) => onChange({ from: fromValue, to: e.target.value })}
          />
        </Field>
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
