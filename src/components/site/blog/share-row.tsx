"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * Share this article: WhatsApp, X, LinkedIn, Facebook, copy link, and the OS share sheet where
 * the browser offers one.
 *
 * WhatsApp is FIRST, not alphabetically or by global market share, but because it is how this
 * audience actually forwards a link to a batch, a trainer or a family member. The order of these
 * buttons is a product decision, not a default.
 *
 * `url` is computed on the SERVER with `absoluteUrl()` and handed in as a plain string. It is
 * never read from `window.location`: under the `/center` base path (and behind any proxy) the
 * canonical address of a post is something only the server knows, and a share is forever.
 *
 * WHY INLINE SVG: lucide ships no brand marks. These four paths are COPIED from
 * `src/components/site/social-links.tsx` — that module exports a branding-driven component, not
 * its glyph table, and belongs to another part of the site. Duplicating four `d` strings is the
 * cheaper coupling.
 */

interface ShareTarget {
  key: string;
  label: string;
  /** The network's own colour, as a literal arbitrary value so Tailwind's scanner emits it. */
  fill: string;
  path: string;
  href: (url: string, title: string) => string;
}

const TARGETS: ShareTarget[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    fill: "bg-[#25D366]",
    path: "M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 2a7.8 7.8 0 1 1-4 14.5l-.35-.2-2.4.63.64-2.32-.22-.35A7.8 7.8 0 0 1 12 4.2ZM8.85 8.3c-.15 0-.4.05-.6.28-.2.23-.78.76-.78 1.85 0 1.09.8 2.14.91 2.29.11.15 1.55 2.47 3.83 3.36 1.9.74 2.29.6 2.7.56.41-.04 1.33-.54 1.52-1.07.19-.53.19-.98.13-1.07-.06-.09-.21-.15-.45-.26-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.11-.53.11-.16.23-.61.77-.75.93-.14.15-.28.17-.51.06-.24-.12-1-.37-1.9-1.17-.7-.62-1.18-1.4-1.32-1.63-.14-.23-.02-.35.1-.47.11-.1.24-.28.36-.42.12-.14.16-.23.24-.39.08-.15.04-.29-.02-.4-.06-.12-.53-1.3-.73-1.78-.19-.46-.38-.4-.53-.41h-.45Z",
    href: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    key: "twitter",
    label: "X, formerly Twitter",
    fill: "bg-[#000000]",
    path: "M4 4h4.3l3.9 5.4L16.9 4H20l-6.3 7.2L20.5 20h-4.3l-4.2-5.8L6.9 20H3.8l6.7-7.6L4 4Zm2.9 1.5 9.4 13h1.4L8.4 5.5H6.9Z",
    href: (url, title) => `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    fill: "bg-[#0A66C2]",
    path: "M5.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.8 9h3.4v11H3.8V9Zm5.7 0h3.3v1.5c.5-.9 1.7-1.8 3.5-1.8 3.6 0 4.3 2.4 4.3 5.4V20h-3.4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H9.5V9Z",
    href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    fill: "bg-[#1877F2]",
    path: "M14 8h2.5V4.5H14c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V20h3.5v-5.5h2.6l.5-3.5h-3.1V9c0-.6.4-1 1-1Z",
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

/**
 * The circular button, shared by every item in the row. `relative` anchors the fill layer;
 * deliberately NOT `overflow-hidden`, which is what would clip the growing fill into a square and
 * (in the `sm` recipe this is derived from) swallow the padded hit area.
 */
const BUTTON =
  "group ring-focus relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-navy tap-highlight-none transition-[box-shadow,transform] duration-element ease-soft motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 hover:shadow-e1";

export function ShareRow({ url, title, className }: { url: string; title: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  /**
   * `navigator.share` only exists on some browsers, so the button cannot be rendered on the
   * server — doing so would either hydrate into a mismatch or show a button that does nothing.
   * It appears after mount, on the devices that have it.
   */
  const canShare = useHydrated() && typeof navigator !== "undefined" && typeof navigator.share === "function";
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // The copy confirmation must not fire on a component that has gone away (navigating off the
  // article mid-toast is the ordinary case).
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    try {
      // `navigator.clipboard` is undefined on an insecure origin, which is a real case on a LAN
      // preview — say so plainly instead of failing silently.
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link", "Select the address bar and copy it by hand.");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // An abort is the normal way to dismiss the OS sheet. Nothing to report.
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <p className="text-overline text-muted">Share</p>
      <ul className="flex flex-wrap items-center gap-2">
        {TARGETS.map((t) => (
          <li key={t.key}>
            <a
              href={t.href(url, title)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${t.label} (opens in a new tab)`}
              className={BUTTON}
            >
              {/*
                The brand fill grows from the centre over --duration-element. Under reduced motion
                the scale utilities are simply never applied (motion-safe:), so the colour still
                arrives — instantly, and without movement.
              */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-full opacity-0 transition-[opacity,transform] duration-element ease-soft",
                  "motion-safe:scale-50 motion-safe:group-hover:scale-100 motion-safe:group-focus-visible:scale-100",
                  "group-hover:opacity-100 group-focus-visible:opacity-100",
                  t.fill
                )}
              />
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="relative h-5 w-5 transition-colors duration-element group-hover:text-white group-focus-visible:text-white motion-reduce:transition-none">
                <path d={t.path} />
              </svg>
            </a>
          </li>
        ))}

        <li>
          <button type="button" onClick={copy} aria-label={copied ? "Link copied" : "Copy link to this article"} className={BUTTON}>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 rounded-full bg-navy transition-[opacity,transform] duration-element ease-soft",
                "motion-safe:scale-50 motion-safe:group-hover:scale-100 motion-safe:group-focus-visible:scale-100",
                copied ? "scale-100 opacity-100 motion-safe:scale-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              )}
            />
            {copied ? (
              <Check className="relative h-5 w-5 text-white" aria-hidden />
            ) : (
              <Link2 className="relative h-5 w-5 transition-colors duration-element group-hover:text-white group-focus-visible:text-white motion-reduce:transition-none" aria-hidden />
            )}
          </button>
        </li>

        {canShare && (
          <li>
            <button type="button" onClick={nativeShare} aria-label="Share using your device" className={BUTTON}>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-full bg-orange opacity-0 transition-[opacity,transform] duration-element ease-soft",
                  "motion-safe:scale-50 motion-safe:group-hover:scale-100 motion-safe:group-focus-visible:scale-100",
                  "group-hover:opacity-100 group-focus-visible:opacity-100"
                )}
              />
              <Share2 className="relative h-5 w-5 transition-colors duration-element group-hover:text-white group-focus-visible:text-white motion-reduce:transition-none" aria-hidden />
            </button>
          </li>
        )}
      </ul>
      {/* The copy result is already a toast; this is the quiet, non-interrupting confirmation for
          anyone who is not watching the corner of the screen. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to the clipboard" : ""}
      </span>
    </div>
  );
}
