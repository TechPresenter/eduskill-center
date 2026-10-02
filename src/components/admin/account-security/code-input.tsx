"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * ONE numeric field for a 6-digit code (authenticator or email): a single label for screen readers,
 * one target for autofill, and pasting "123 456" or a whole message still yields the six digits.
 * Letter-spacing gives it the six-slot look; 16px+ text so Android never zooms.
 */
export const CodeInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "value" | "onChange"> & { value: string; onValueChange: (v: string) => void }>(function CodeInput(
  { value, onValueChange, className, ...props },
  ref
) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      onPaste={(e) => {
        const match = e.clipboardData.getData("text").match(/(?<!\d)(\d{3})[\s-]?(\d{3})(?!\d)/);
        if (match) {
          e.preventDefault();
          onValueChange(`${match[1]}${match[2]}`);
        }
      }}
      placeholder="••••••"
      className={cn("text-center font-heading text-xl font-bold tracking-[0.5em] tabular-nums sm:text-xl", "pl-[calc(0.875rem+0.5em)]", className)}
      {...props}
    />
  );
});
