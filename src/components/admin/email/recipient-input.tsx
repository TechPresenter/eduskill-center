"use client";

import * as React from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidEmail, splitAddresses } from "@/components/admin/email/html-tools";

export interface RecipientInputProps {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Email-address chips. Typing a comma, semicolon, space or Enter (or leaving the field, or pasting a
 * list) turns the text into chips; addresses are lower-cased and de-duplicated. An invalid address
 * stays visible as a red chip (with an icon and an "invalid" label for screen readers) so it can be
 * corrected, and the server re-validates everything.
 */
export function RecipientInput({ id, value, onChange, invalid, "aria-describedby": describedBy, placeholder = "name@example.com", disabled }: RecipientInputProps) {
  const [text, setText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const parts = splitAddresses(raw).filter((a) => !value.includes(a));
    if (parts.length) onChange([...value, ...parts]);
    setText("");
  };

  const remove = (address: string) => {
    onChange(value.filter((v) => v !== address));
    inputRef.current?.focus();
  };

  const bad = value.filter((v) => !isValidEmail(v)).length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) inputRef.current?.focus();
      }}
      className={cn(
        "flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 transition-colors duration-micro focus-within:ring-2 motion-reduce:transition-none sm:min-h-10",
        invalid || bad ? "border-danger focus-within:border-danger focus-within:ring-danger/20" : "border-line focus-within:border-navy focus-within:ring-navy/20",
        disabled && "pointer-events-none bg-surface opacity-60"
      )}
    >
      {value.map((v) => {
        const ok = isValidEmail(v);
        return (
          <span
            key={v}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-0.5 pl-2.5 text-sm font-medium",
              ok ? "bg-lavender text-navy" : "border border-danger/40 bg-danger-light text-danger"
            )}
          >
            {!ok && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{v}</span>
            {!ok && <span className="sr-only"> (not a valid email address)</span>}
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="ring-focus inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full tap-highlight-none transition-colors duration-micro hover:bg-navy/10 focus-visible:ring-0 focus-visible:ring-offset-0 pointer-coarse:-my-1.5 pointer-coarse:h-9 pointer-coarse:w-9 motion-reduce:transition-none"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        id={id}
        // type="text": an email input strips the trailing space that commits a chip.
        type="text"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={invalid || bad > 0 || undefined}
        aria-describedby={describedBy}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          // A separator typed (or a list pasted) commits what precedes it.
          if (/[,;\s]/.test(v)) {
            const lastSep = Math.max(v.lastIndexOf(","), v.lastIndexOf(";"), v.search(/\s(?=[^\s]*$)/));
            add(v.slice(0, lastSep + 1));
            setText(v.slice(lastSep + 1).trimStart());
          } else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (text.trim()) add(text);
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/[,;\s<]/.test(pasted)) {
            e.preventDefault();
            add(`${text} ${pasted}`);
          }
        }}
        onBlur={() => {
          if (text.trim()) add(text);
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[12rem] flex-1 bg-transparent px-1.5 py-1 text-base text-ink outline-none placeholder:text-muted/70 sm:text-sm"
      />
    </div>
  );
}
