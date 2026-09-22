"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { TabLinks, type TabLink } from "@/components/admin/shared/tab-links";

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

/**
 * Tabs whose active value lives in the URL, so the server page can render tab-specific data.
 *
 * Each tab is now a real link rendered by the shared `TabLinks` strip instead of a `role="tab"` button:
 * switching tab loads a different server render, which is navigation, not a tab panel swap. Keyboard
 * users get the usual link behaviour, middle-click and "open in new tab" work, and Next prefetches the
 * neighbouring tabs. Props are unchanged, so the pages using this did not have to move.
 */
export function QueryTabs({ items, param = "tab", defaultValue, keep = [], className }: QueryTabsProps) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const fallback = defaultValue ?? items[0]?.value ?? "";
  const value = sp.get(param) || fallback;

  const links: TabLink[] = items.map((t) => {
    const next = new URLSearchParams();
    for (const k of keep) {
      const cur = sp.get(k);
      if (cur) next.set(k, cur);
    }
    // The default tab is the bare URL, so every tab has exactly one address.
    if (t.value && t.value !== fallback) next.set(param, t.value);
    const qs = next.toString();
    return { value: t.value, label: t.label, count: t.count, href: qs ? `${pathname}?${qs}` : pathname };
  });

  // `scroll={false}`: the strip sits at the top of the list, and a tab change should not throw away
  // the reading position of someone comparing two tabs.
  return <TabLinks items={links} active={value} ariaLabel="Views" scroll={false} className={className} />;
}

/**
 * Client-side tabs over panels that are all already on the page; the active tab is mirrored into the URL
 * for deep links. This is the case where `role="tablist"` / `role="tabpanel"` is the correct pattern —
 * see `QueryTabs` above for the case where it is not.
 */
export function TabbedPanels({ items, panels, param = "tab", defaultValue, className }: { items: TabItem[]; panels: Record<string, React.ReactNode>; param?: string; defaultValue?: string; className?: string }) {
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
    // replaceState rather than a router push: the panels are already rendered, so this only needs to
    // make the current view linkable, not add a history entry per tap.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };
  const label = items.find((t) => t.value === value)?.label;
  return (
    <div className={className}>
      {/* Page-level strips bleed to the screen edge on phones so the row swipes without a clipped first chip. */}
      <Tabs items={items} value={value} onChange={onChange} className={cn("-mx-4 max-w-[100vw] px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:max-w-none lg:px-0", "mb-5")} />
      <div role="tabpanel" aria-label={typeof label === "string" ? label : undefined}>
        {panels[value] ?? panels[items[0]?.value ?? ""]}
      </div>
    </div>
  );
}
