import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  placeholder?: string;
  /** Red border + `aria-invalid`. */
  invalid?: boolean;
  /** Green border once validated. */
  valid?: boolean;
  children?: React.ReactNode;
}

/** Native `<select>` (system picker on Android/iOS) styled like Input; inherits the 44px mobile height. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, invalid, valid, className, children, value, defaultValue, ...props },
  ref
) {
  const controlled = value !== undefined;
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        data-valid={valid && !invalid ? "true" : undefined}
        className={cn(inputClasses, "appearance-none pr-10", className)}
        value={controlled ? value : undefined}
        defaultValue={!controlled ? (defaultValue ?? "") : undefined}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled={props.required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-5 w-5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});
