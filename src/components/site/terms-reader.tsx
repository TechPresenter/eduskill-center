"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/stats";

/** A terms document as a form receives it from its server page (`getTerms`). */
export interface TermsProp {
  title: string;
  /** Fingerprint of this exact text; sent back with the application so the server can check it. */
  version: string;
  /** "05 Oct 2026" (India time) of the last edit, formatted on the server; null for the built-in text. */
  updatedLabel: string | null;
  /** The public page with the full text (opened in a new tab from the box header). */
  path: string;
  /** The terms, already rendered from Markdown on the server (`<Markdown anchors={false} />`). */
  body: React.ReactNode;
}

/** A length custom property on <html> in px — the fixed bottom bars publish theirs in px or rem. */
function rootLengthPx(name: string): number {
  const style = getComputedStyle(document.documentElement);
  const raw = style.getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.endsWith("rem") ? n * (parseFloat(style.fontSize) || 16) : n;
}

/**
 * Reads a Terms & Conditions document in a scrollable box and takes the applicant's consent. The
 * consent box unlocks once the last line has been on screen, so nobody can tick it without at least
 * scrolling through the terms. An acceptance that is already there (Back, a restored draft) stays
 * unlocked, and unticking it does not lock it again.
 *
 * Key it by `terms.version` so a newer text (after a refresh) starts the reader again.
 */
export function TermsReader({
  terms,
  accepted,
  onAcceptedChange,
  error,
  checkboxLabel,
}: {
  terms: TermsProp;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  error?: string;
  checkboxLabel: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = React.useState(accepted);
  const [readPct, setReadPct] = React.useState(0);
  const titleId = React.useId();

  /**
   * The last line counts as read only while it is inside the box AND on screen above the fixed
   * bottom bars on phones (a wizard's action bar publishes --sticky-bar-h, the site's tab bar
   * --bottom-nav-h) — so a quick flick that leaves it hidden under a bar does not unlock the box.
   */
  const checkEnd = React.useCallback(() => {
    const box = scrollRef.current;
    const end = endRef.current;
    if (!box || !end) return;
    const bar = rootLengthPx("--sticky-bar-h") + rootLengthPx("--bottom-nav-h");
    const boxRect = box.getBoundingClientRect();
    const endRect = end.getBoundingClientRect();
    const seen = endRect.top <= Math.min(boxRect.bottom, window.innerHeight - bar) && endRect.bottom >= Math.max(boxRect.top, 0);
    const max = box.scrollHeight - box.clientHeight;
    setReadPct(seen ? 100 : max > 0 ? Math.min(99, Math.round((box.scrollTop / max) * 100)) : 0);
    if (seen) setReachedEnd(true);
  }, []);

  // The page scrolling (or resizing) can bring the last line into view too; the first frame covers
  // text short enough to fit without scrolling.
  React.useEffect(() => {
    if (reachedEnd) return;
    const frame = requestAnimationFrame(checkEnd);
    window.addEventListener("scroll", checkEnd, { passive: true });
    window.addEventListener("resize", checkEnd);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", checkEnd);
      window.removeEventListener("resize", checkEnd);
    };
  }, [reachedEnd, checkEnd]);

  // An acceptance restored after mount (a saved draft) counts as having read to the end.
  const ended = reachedEnd || accepted;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-card border border-line">
        <div className="flex flex-col gap-1 border-b border-line bg-surface/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-h4 text-navy">
              {terms.title}
            </h3>
            {terms.updatedLabel && <p className="text-caption text-muted">Last updated {terms.updatedLabel}</p>}
          </div>
          <Link
            href={terms.path}
            target="_blank"
            rel="noopener noreferrer"
            className="ring-focus inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-md text-body-sm font-semibold text-orange hover:underline sm:self-auto"
          >
            Open in a new tab
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {/* Focusable so keyboard users can scroll it; `relative` keeps sr-only descendants inside. Below lg
            it is sized to fit between the app bar, the wizard progress and the fixed bottom bars. */}
        <div
          ref={scrollRef}
          onScroll={checkEnd}
          tabIndex={0}
          role="region"
          aria-labelledby={titleId}
          lang="hi"
          className="ring-focus-inset relative max-h-[max(12rem,calc(100svh_-_var(--header-h)_-_var(--sticky-bar-h)_-_var(--bottom-nav-h)_-_15rem))] overflow-y-auto px-4 py-4 sm:px-6 lg:max-h-[28rem]"
        >
          {terms.body}
          <div ref={endRef} className="h-px" aria-hidden />
        </div>
        <div className="border-t border-line bg-surface/60 px-4 py-3">
          {ended ? (
            <p className="flex items-center gap-1.5 text-body-sm font-semibold text-success-dark">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> You have reached the end of the terms.
            </p>
          ) : (
            <ProgressBar value={readPct} label="Scroll to the end to continue" />
          )}
          <p className="sr-only" aria-live="polite">
            {reachedEnd && !accepted ? "You have reached the end of the terms. You can now tick the box to accept them." : ""}
          </p>
        </div>
      </div>

      <Field error={error}>
        <Checkbox
          checked={accepted}
          disabled={!ended}
          onChange={(e) => {
            // Only someone who could tick it can untick it: keep the box unlocked afterwards.
            if (!e.target.checked) setReachedEnd(true);
            onAcceptedChange(e.target.checked);
          }}
          className={ended ? undefined : "cursor-not-allowed opacity-60"}
          label={checkboxLabel}
          description={
            ended
              ? "Your acceptance is saved with your application, together with the date, time and version of these terms."
              : "Scroll to the end of the terms above to unlock this box."
          }
        />
      </Field>
    </div>
  );
}
