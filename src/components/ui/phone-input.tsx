"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input";
import { COUNTRIES, DEFAULT_ISO2, countryByIso2, countryFromE164, parsePhone } from "@/lib/phone";

/** `useSyncExternalStore` needs a subscribe; flag support never changes after the first paint. */
const subscribeNever = () => () => {};

export interface PhoneInputProps {
  /**
   * E.164 (`+919876543210`) once the number is valid. While it is still incomplete this is
   * `+<dial><digits so far>`, so the chosen country survives a round trip through the parent's state
   * and the server can name the right country in its error message.
   */
  value: string;
  onChange: (value: string) => void;
  /** Injected by `<Field>` — goes to the TEXT input, which is what the label points at. */
  id?: string;
  /** When set, a hidden input carries the E.164 value for a native form submit. */
  name?: string;
  invalid?: boolean;
  valid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Country to start on when `value` is empty. Defaults to India. */
  defaultCountry?: string;
  /** `tel-national` is right here: the country lives in its own control. */
  autoComplete?: string;
  placeholder?: string;
  /** Fired when focus leaves the whole control — not when it moves between the two parts of it. */
  onBlur?: () => void;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * Regional-indicator pairs are NOT reliable: Windows ships no flag glyphs, so Chrome and Edge render
 * 🇮🇳 as the letters "IN" in two boxes. A flag can therefore only ever be decoration here — the dial
 * code is always present as text, and the country's name and ISO code carry the meaning.
 *
 * Measured once per document: a supported flag draws as a single glyph, which is narrower than two
 * letter boxes. Anything unexpected answers "no flags", which is the safe direction.
 */
let flagSupport: boolean | null = null;
function detectFlagSupport(): boolean {
  if (flagSupport !== null) return flagSupport;
  flagSupport = false;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      const pair = ctx.measureText("\u{1F1EE}\u{1F1F3}").width;
      const single = ctx.measureText("\u{1F1EE}").width;
      flagSupport = pair > 0 && single > 0 && pair < single * 2 - 1;
    }
  } catch {
    flagSupport = false;
  }
  return flagSupport;
}

/** ISO 3166-1 alpha-2 → the regional-indicator pair. Decoration only (see `detectFlagSupport`). */
function flagEmoji(iso2: string): string {
  return iso2.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** Splits a stored or in-progress value into the country to show and the digits to show. */
function split(raw: string | null | undefined, currentIso2: string): { iso2: string; digits: string } {
  const s = (raw ?? "").trim();
  if (!s) return { iso2: currentIso2, digits: "" };
  const parsed = parsePhone(s, currentIso2);
  if (parsed.ok) return { iso2: parsed.country.iso2, digits: parsed.national };
  if (s.startsWith("+")) {
    // Incomplete, but the dial code may already identify the country.
    const c = countryFromE164(s);
    const digits = s.replace(/\D/g, "");
    if (c) return { iso2: c.iso2, digits: digits.slice(c.dial.length) };
    return { iso2: currentIso2, digits };
  }
  return { iso2: currentIso2, digits: s.replace(/\D/g, "") };
}

const TYPEAHEAD_MS = 800;

/**
 * Country selector + national number, in the shared control styling.
 *
 * Two adjacent controls rather than one fused shell: both keep the 44px (`min-h-11`) / 40px
 * (`sm:min-h-10`) height and the 16px (`text-base`) type that stops Android zooming on focus, and
 * each keeps its own focus ring — fusing them means overriding the radii and merging the rings,
 * which is how a visible focus outline gets lost.
 *
 * The country control is the APG select-only combobox: a real `role="combobox"` button over a
 * `role="listbox"`, keyboard operable (arrows, Home/End, Enter, Escape, type-to-search across both
 * country names and dial codes), with `aria-activedescendant` so focus never leaves the button.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  name,
  invalid,
  valid,
  disabled,
  required,
  defaultCountry = DEFAULT_ISO2,
  autoComplete = "tel-national",
  placeholder,
  onBlur,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: PhoneInputProps) {
  const reactId = React.useId();
  const listId = `${reactId}-country-list`;
  const buttonId = `${reactId}-country`;

  // Seeded once from `value`; after mount the two states own the control and the effect below
  // re-syncs them only when the PARENT changes the value.
  const seed = () => split(value, countryByIso2(defaultCountry)?.iso2 ?? DEFAULT_ISO2);
  const [iso2, setIso2] = React.useState(() => seed().iso2);
  const [digits, setDigits] = React.useState(() => seed().digits);
  /** The last value we handed the parent, so a value coming back in is not mistaken for a reset. */
  const [emitted, setEmitted] = React.useState(value);

  const country = countryByIso2(iso2) ?? countryByIso2(DEFAULT_ISO2)!;

  // Re-sync when the PARENT changes the value (a form reset, or a profile loading from the server).
  // Values we emitted ourselves are ignored, so typing is never fought over. Adjusted during render
  // rather than in an effect — no wasted commit, and no flash of the stale number.
  const [lastValue, setLastValue] = React.useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    if (value !== emitted) {
      setEmitted(value);
      const next = split(value, iso2);
      setIso2(next.iso2);
      setDigits(next.digits);
    }
  }

  const emit = React.useCallback(
    (nextIso2: string, nextDigits: string) => {
      const c = countryByIso2(nextIso2) ?? countryByIso2(DEFAULT_ISO2)!;
      const parsed = parsePhone(nextDigits, nextIso2);
      // Valid → E.164. Incomplete → keep the dial code on the front so the country is not lost.
      const out = parsed.ok ? parsed.e164 : nextDigits ? `+${c.dial}${nextDigits}` : "";
      setEmitted(out);
      setLastValue(out);
      onChange(out);
    },
    [onChange]
  );

  const setCountry = (nextIso2: string) => {
    setIso2(nextIso2);
    emit(nextIso2, digits);
  };

  /** Accepts a pasted or typed string: a `+`-prefixed number switches the country. */
  const acceptText = (text: string) => {
    const parsed = parsePhone(text, iso2);
    if (parsed.ok) {
      setIso2(parsed.country.iso2);
      setDigits(parsed.national);
      emit(parsed.country.iso2, parsed.national);
      return;
    }
    const next = text.replace(/\D/g, "").slice(0, country.nsnMax);
    setDigits(next);
    emit(iso2, next);
  };

  // ── The country listbox ───────────────────────────────────────────────────────────────────────
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const typed = React.useRef<{ buffer: string; timer: number | undefined }>({ buffer: "", timer: undefined });
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);

  // `false` on the server and in the first client render, so hydration cannot mismatch; the real
  // answer arrives on the pass after mount. `detectFlagSupport` memoises, so the snapshot is stable.
  const flags = React.useSyncExternalStore(subscribeNever, detectFlagSupport, () => false);

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, COUNTRIES.findIndex((c) => c.iso2 === iso2)));
    setOpen(true);
  };

  // Forget the last position when the list closes (render-phase reset, as `Dropdown` does), so the
  // next open is measured afresh instead of flashing at the old spot.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (!open) setPos(null);
  }

  // Portalled and fixed, so a scrolling ancestor (a Drawer, an admin panel) cannot clip the list.
  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const h = listRef.current?.offsetHeight ?? 0;
      const gap = 6;
      const below = r.bottom + gap;
      const top = h && below + h > window.innerHeight - gap && r.top - gap - h > gap ? r.top - gap - h : below;
      setPos({ top, left: Math.max(gap, Math.min(r.left, document.documentElement.clientWidth - 288 - gap)), width: r.width });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (index: number) => {
    const c = COUNTRIES[index];
    if (!c) return;
    setCountry(c.iso2);
    setOpen(false);
    btnRef.current?.focus();
  };

  /** Type-to-search across country name, ISO code and dial code — what a native select cannot do. */
  const jumpTo = (char: string) => {
    const t = typed.current;
    t.buffer += char;
    if (t.timer !== undefined) window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => {
      t.buffer = "";
      t.timer = undefined;
    }, TYPEAHEAD_MS);
    const q = t.buffer.toLowerCase();
    const digitsOnly = q.replace(/\D/g, "");
    const found = COUNTRIES.findIndex(
      (c) => c.name.toLowerCase().startsWith(q) || c.iso2.toLowerCase().startsWith(q) || (digitsOnly.length > 0 && q === digitsOnly && c.dial.startsWith(digitsOnly))
    );
    if (found >= 0) {
      setActive(found);
      if (!open) setOpen(true);
    }
  };

  const onButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = COUNTRIES.length - 1;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
        return;
      }
    } else {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setOpen(false);
          return;
        case "Enter":
        case " ":
          e.preventDefault();
          choose(active);
          return;
        case "Tab":
          // Tab commits the highlighted country and moves on, like a native select.
          choose(active);
          return;
        case "ArrowDown":
          e.preventDefault();
          setActive((i) => Math.min(last, i + 1));
          return;
        case "ArrowUp":
          e.preventDefault();
          setActive((i) => Math.max(0, i - 1));
          return;
        case "Home":
          e.preventDefault();
          setActive(0);
          return;
        case "End":
          e.preventDefault();
          setActive(last);
          return;
        case "PageDown":
          e.preventDefault();
          setActive((i) => Math.min(last, i + 8));
          return;
        case "PageUp":
          e.preventDefault();
          setActive((i) => Math.max(0, i - 8));
          return;
      }
    }
    if (e.key.length === 1 && /\S/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      jumpTo(e.key);
    }
  };

  const optionId = (i: number) => `${listId}-${COUNTRIES[i].iso2}`;

  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label="Country"
      // Focus stays on the combobox button, so the list itself is not in the tab order.
      tabIndex={-1}
      style={pos ? { top: pos.top, left: pos.left } : { opacity: 0 }}
      className="fixed z-overlay max-h-64 w-72 overflow-y-auto overscroll-contain rounded-lg border border-line bg-white py-1 shadow-e3 animate-pop motion-reduce:animate-none"
    >
      {COUNTRIES.map((c, i) => {
        const selected = c.iso2 === iso2;
        return (
          <li
            key={c.iso2}
            id={optionId(i)}
            role="option"
            aria-selected={selected}
            data-active={i === active ? "true" : undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(i)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 px-3 text-base sm:min-h-10 sm:text-sm",
              i === active ? "bg-lavender text-navy" : "text-ink",
              selected && "font-semibold"
            )}
          >
            {flags && (
              <span className="text-lg leading-none" aria-hidden>
                {flagEmoji(c.iso2)}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="shrink-0 tabular-nums text-muted">+{c.dial}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-orange" aria-hidden />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={cn("flex items-start gap-2", className)}
      onBlur={(e) => {
        // Only when focus leaves the pair, so tabbing from the country to the number is not a blur.
        if (onBlur && !e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur();
      }}
    >
      <button
        ref={btnRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
        className={cn(inputClasses, "relative flex w-30 shrink-0 cursor-pointer items-center gap-1.5 pr-9 text-left tap-highlight-none disabled:cursor-not-allowed")}
      >
        <span className="sr-only">Country code: {country.name}, </span>
        {flags && (
          <span className="text-lg leading-none" aria-hidden>
            {flagEmoji(country.iso2)}
          </span>
        )}
        <span className="truncate">
          {country.iso2} <span className="tabular-nums">+{country.dial}</span>
        </span>
        <ChevronDown className="pointer-events-none absolute right-3.5 h-5 w-5 text-muted sm:h-4 sm:w-4" aria-hidden />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        aria-describedby={describedBy}
        data-valid={valid && !invalid ? "true" : undefined}
        value={digits}
        maxLength={country.nsnMax}
        placeholder={placeholder ?? country.example}
        onChange={(e) => acceptText(e.target.value)}
        onPaste={(e) => {
          // Intercepted because `maxLength` would silently truncate a pasted "+91 98765 43210"
          // before onChange ever saw the country code.
          const text = e.clipboardData.getData("text");
          if (!text) return;
          e.preventDefault();
          acceptText(text);
        }}
        className={cn(inputClasses, "min-w-0 flex-1 tabular-nums")}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {/* `open` can only be true after a click, so `document` always exists by the time this runs. */}
      {open && createPortal(list, document.body)}
    </div>
  );
}
