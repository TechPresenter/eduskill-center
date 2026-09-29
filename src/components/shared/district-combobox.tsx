"use client";

import * as React from "react";
import { Check, Loader2, MapPin, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input";

export interface DistrictOption {
  id: string;
  name: string;
  stateId: string;
  stateName: string;
}

export interface DistrictComboboxProps {
  /** The chosen district, or null while the applicant is still typing. */
  value: DistrictOption | null;
  onChange: (district: DistrictOption | null) => void;
  id: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
}

const cache = new Map<string, DistrictOption[]>();

/**
 * Type-ahead over the real `District` table (764 rows), so "City / District" always resolves to a
 * row the rest of the platform knows — never a free-text string the admin queue cannot filter on.
 *
 * Deliberately one field rather than the three-select `LocationCascade`: the short teacher form
 * asks for one location, and an applicant who knows their district should not have to find their
 * state first. The search matches state names too, so typing "Kerala" lists that state's districts.
 *
 * Nothing is auto-picked. If the text never resolves, the value stays null, the form blocks the
 * submit, and the server rejects the empty `districtId` as well — an unresolvable location is an
 * error shown to the applicant, never a guess.
 *
 * One `<input>` carries `id` in both states (typing and resolved), so a `<Field label>` and the
 * error summary always have a focusable target.
 */
export function DistrictCombobox({ value, onChange, id, placeholder = "Start typing your city or district", invalid, disabled, describedBy, className }: DistrictComboboxProps) {
  const [text, setText] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [fetched, setFetched] = React.useState<{ key: string; items: DistrictOption[] } | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-listbox`;

  const query = text.trim();
  const key = query.toLowerCase();
  const searching = !value && query.length >= 2;
  // Results are DERIVED from the query they belong to (module cache first, then the last response),
  // so a stale list is never shown and no state is set synchronously inside an effect.
  const items: DistrictOption[] | null = !searching ? [] : (cache.get(key) ?? (fetched?.key === key ? fetched.items : null));
  const options = items ?? [];
  const loading = searching && items === null;

  // Debounced fetch. A response that lands after the text moved on still warms the cache; the
  // `stale` guard only stops it from touching state.
  React.useEffect(() => {
    if (!searching || cache.has(key)) return;
    let stale = false;
    const t = setTimeout(() => {
      api
        .get<{ districts: DistrictOption[] }>(`/api/public/locations?q=${encodeURIComponent(key)}`)
        .then((d) => {
          cache.set(key, d.districts);
          if (!stale) setFetched({ key, items: d.districts });
        })
        .catch(() => {
          if (!stale) setFetched({ key, items: [] });
        });
    }, 220);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [searching, key]);

  // Close on an outside click; Escape is handled on the input so focus stays put.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (d: DistrictOption) => {
    onChange(d);
    setText("");
    setActive(0);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setText("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const resolved = value !== null;
  const showList = !resolved && open && searching;
  // Clamped rather than reset from an effect, so a shrinking list can never point past its end.
  const activeIndex = options.length ? Math.min(active, options.length - 1) : 0;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        readOnly={resolved}
        placeholder={placeholder}
        value={resolved ? `${value.name}, ${value.stateName}` : text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          if (!resolved) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (resolved) {
            // Backspace / Delete on the confirmed value reopens the search rather than trapping it.
            if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault();
              clear();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            const o = options[activeIndex];
            if (showList && o) {
              e.preventDefault();
              pick(o);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(inputClasses, "pr-20", resolved && "border-success bg-success-light/30 font-semibold read-only:cursor-default")}
      />

      <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {resolved ? (
          <>
            <Check className="h-4 w-4 text-success" aria-hidden />
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label={`Change city or district (currently ${value.name}, ${value.stateName})`}
              className="ring-focus inline-flex h-9 w-9 items-center justify-center rounded-md text-muted tap-highlight-none transition-colors duration-micro hover:bg-lavender hover:text-navy motion-reduce:transition-none"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : (
          <span className="pointer-events-none pr-1.5 text-muted" aria-hidden>
            {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <MapPin className="h-4 w-4" />}
          </span>
        )}
      </span>

      {showList && (
        <ul id={listId} role="listbox" aria-label="Matching districts" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-white py-1 shadow-e2">
          {loading && options.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">Searching…</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No district matches “{text.trim()}”. Try the district your city belongs to.</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // mousedown, not click: blur would close the list before click could fire.
                e.preventDefault();
                pick(o);
              }}
              className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm", i === activeIndex ? "bg-lavender text-navy" : "text-ink")}
            >
              <span className="font-semibold">{o.name}</span>
              <span className="shrink-0 text-xs text-muted">{o.stateName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
