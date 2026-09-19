"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tabs, type TabItem } from "@/components/ui/tabs";

/** Page-level tab strips bleed to the screen edge on phones so the row swipes without a clipped first chip. */
const STRIP = "-mx-4 max-w-[100vw] px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:max-w-none lg:px-0";

/** Keeps the active tab in view inside the scrolling strip (phones show 3–4 of up to 12 tabs). */
function useScrollActiveTabIntoView(value: string) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    const strip = el?.parentElement;
    if (!el || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: Math.max(0, el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2), behavior: "smooth" });
  }, [value]);
  return ref;
}

interface QueryTabsProps {
  items: TabItem[];
  /** Query key that stores the active tab (default `tab`). */
  param?: string;
  /** Value used when the key is absent (default: first item). */
  defaultValue?: string;
  /** Query keys to keep when switching (everything else is dropped so tab-specific filters do not leak). */
  keep?: string[];
  className?: string;
}

/** Tabs whose active value lives in the URL, so server pages can render tab-specific data. */
export function QueryTabs({ items, param = "tab", defaultValue, keep = [], className }: QueryTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const value = sp.get(param) || defaultValue || items[0]?.value || "";
  const onChange = (v: string) => {
    const next = new URLSearchParams();
    for (const k of keep) {
      const cur = sp.get(k);
      if (cur) next.set(k, cur);
    }
    if (v && v !== (defaultValue ?? items[0]?.value)) next.set(param, v);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const ref = useScrollActiveTabIntoView(value);
  return (
    <div ref={ref} className="contents">
      <Tabs items={items} value={value} onChange={onChange} className={cn(STRIP, className)} />
    </div>
  );
}

/** Client-side tabs over pre-rendered panels; the active tab is mirrored into the URL for deep links. */
export function TabbedPanels({ items, panels, param = "tab", defaultValue, className }: { items: TabItem[]; panels: Record<string, React.ReactNode>; param?: string; defaultValue?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const initial = sp.get(param) || defaultValue || items[0]?.value || "";
  const [value, setValue] = React.useState(initial);
  const [syncedInitial, setSyncedInitial] = React.useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setValue(initial);
  }
  const onChange = (v: string) => {
    setValue(v);
    const next = new URLSearchParams(sp.toString());
    if (v === (defaultValue ?? items[0]?.value)) next.delete(param);
    else next.set(param, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const ref = useScrollActiveTabIntoView(value);
  return (
    <div ref={ref} className={className}>
      <Tabs items={items} value={value} onChange={onChange} className={cn(STRIP, "mb-5")} />
      <div role="tabpanel">{panels[value] ?? panels[items[0]?.value ?? ""]}</div>
    </div>
  );
}
