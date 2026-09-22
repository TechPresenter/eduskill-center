"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Window event the site header listens for to open its search (full-screen sheet on phones, palette on
 * sm+). Dispatched cancelable: when the header handles it, it calls `preventDefault()` and this link's
 * navigation is cancelled. When nothing handles it (header not updated yet, or JS still loading) the
 * link simply goes to /search, the shareable results page — so the bar can never be a dead control.
 */
export const OPEN_SITE_SEARCH_EVENT = "site:open-search";

/**
 * The phone home screen's search bar. It LOOKS like an input (icon, placeholder, 48px tall) but is a
 * link: typing happens in the header's search sheet, which already owns recents, results and keyboard
 * handling. Never render two search implementations.
 */
export function HomeSearchBar({ className }: { className?: string }) {
  return (
    <Link
      href="/search"
      aria-haspopup="dialog"
      aria-label="Search courses, centres and PIN codes"
      onClick={(e) => {
        // Let modified clicks (new tab / window) behave like a normal link.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const ev = new CustomEvent(OPEN_SITE_SEARCH_EVENT, { cancelable: true });
        window.dispatchEvent(ev);
        if (ev.defaultPrevented) e.preventDefault();
      }}
      className={cn(
        "press ring-focus flex h-13 w-full items-center gap-3 rounded-xl border border-line bg-white px-4 text-left shadow-e2 tap-highlight-none",
        className
      )}
    >
      <Search className="size-5 shrink-0 text-navy" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-body text-muted">Search courses, centres, PIN code</span>
    </Link>
  );
}
