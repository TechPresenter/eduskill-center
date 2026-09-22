"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import { HeroIllustration } from "@/components/site/hero-illustration";
import { SafeImage } from "@/components/site/safe-image";
import { cn } from "@/lib/utils";

export interface HeroSlideData {
  eyebrow?: string;
  title: string;
  /** Optional short title for phones (≤ 2 lines). Falls back to the first line of `title`. */
  mobileTitle?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  tertiaryLabel?: string;
  tertiaryHref?: string;
  imageUrl?: string;
  imageAlt?: string;
}

const AUTOPLAY_MS = 7000;

/** A line ending in one of these reads as cut off, so the phone title carries on into the next line. */
const DANGLING = /\b(for|in|to|of|and|or|the|a|an|with|at|by|from|through)$|&$/i;

/**
 * The phone title: the CMS `mobileTitle` when set, otherwise the first CMS line of the title, plus the
 * following line while the text so far ends on a connector ("Foundational Learning for" + "Class 1 to 4").
 */
export function phoneTitle(title: string, mobileTitle?: string) {
  const short = mobileTitle?.trim();
  if (short) return short;
  const lines = title
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return title;
  let text = lines[0];
  for (let i = 1; i < lines.length && DANGLING.test(text.replace(/\]\]$/, "")); i++) text = `${text} ${lines[i]}`;
  return text;
}

/**
 * The hero <h1>. One heading, two renderings: the short phone title at the h1 step below lg, and the
 * full CMS title (its line breaks honoured) from lg, sized so the seeded three lines stay three lines
 * in the seven-column copy area. The hidden rendering is `display: none`, so screen readers and the
 * accessibility tree only ever get one of them.
 */
export function HeroTitle({ title, mobileTitle }: { title: string; mobileTitle?: string }) {
  return (
    <h1 className="text-white">
      <span className="block text-h1 text-balance lg:hidden">
        <Highlight text={phoneTitle(title, mobileTitle)} />
      </span>
      <span className="hidden font-heading text-[2.5rem] leading-[1.1] font-extrabold tracking-tight lg:block xl:text-[3rem]">
        <Highlight text={title} />
      </span>
    </h1>
  );
}

/** Cross-fade duration. Kept under the project's 300ms animation ceiling. */
const FADE_MS = 250; // --duration-element

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/**
 * The homepage hero as a cross-fading slider.
 *
 * Slides are stacked in a single CSS grid cell rather than absolutely positioned, so the hero is
 * always as tall as its tallest slide and the page never jumps as slides change — no measuring,
 * no reserved magic number. A scroll-snap carousel would be the wrong tool here: a hero wants a
 * fade, and its content must not be reachable by horizontal scroll.
 *
 * The badge and the training-centre finder card are functional, not editorial, so they are passed
 * in as children and stay put while the editorial content changes behind them.
 */
export function HeroSlider({
  slides,
  badge,
  finderCard,
}: {
  slides: HeroSlideData[];
  badge?: React.ReactNode;
  finderCard?: React.ReactNode;
}) {
  const count = slides.length;
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [userStopped, setUserStopped] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  // Screen readers should hear slide changes only once the visitor is driving, never while the
  // carousel advances on its own.
  const [manual, setManual] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const go = React.useCallback(
    (next: number) => {
      setManual(true);
      setActive(((next % count) + count) % count);
    },
    [count],
  );

  // Pause while off-screen so a hero far up the page is not silently cycling.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const autoplayOn = count > 1 && !reduced && !paused && !userStopped && visible;

  React.useEffect(() => {
    if (!autoplayOn) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [autoplayOn, count]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    }
  };

  // Touch swipe. Horizontal intent only, so a vertical page scroll is never hijacked.
  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(active + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Highlights"
      className="relative"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <p className="sr-only">
        Slide {active + 1} of {count}. Use the left and right arrow keys to change slide.
      </p>

      <div className="container-x relative grid items-center gap-8 pt-6 pb-4 sm:pt-10 lg:grid-cols-12 lg:py-24">
        {/* Editorial column — every slide occupies the same grid cell, so the column is as tall as
            the longest slide and nothing reflows on change. */}
        <div className="grid lg:col-span-7" aria-live={manual && !autoplayOn ? "polite" : "off"}>
          {slides.map((s, i) => {
            const on = i === active;
            return (
              <div
                key={i}
                // Stack every slide in the single grid cell at row 1 / column 1.
                className={cn(
                  "col-start-1 row-start-1 transition-opacity motion-reduce:transition-none",
                  on ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                style={{ transitionDuration: `${FADE_MS}ms` }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={!on}
                // Keeps Tab out of the slides that are faded out.
                inert={!on}
              >
                {s.eyebrow && <p className="eyebrow mb-2 text-orange lg:mb-4">{s.eyebrow}</p>}
                <HeroTitle title={s.title} mobileTitle={s.mobileTitle} />
                {s.subtitle && <p className="mt-2 line-clamp-3 max-w-xl text-body-sm text-white/80 sm:text-body lg:mt-6 lg:line-clamp-none lg:text-body-lg">{s.subtitle}</p>}
                {/* On phones a slide's own CTA is one compact link; the full button row is desktop's. */}
                {s.primaryLabel && s.primaryHref && (
                  <ButtonLink href={s.primaryHref} variant="link" className="mt-2 min-h-11 text-white hover:text-orange lg:hidden" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    {s.primaryLabel}
                  </ButtonLink>
                )}
                <div className="mt-8 hidden gap-3 lg:flex lg:items-center">
                  {s.primaryLabel && s.primaryHref && (
                    <ButtonLink href={s.primaryHref} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                      {s.primaryLabel}
                    </ButtonLink>
                  )}
                  {s.secondaryLabel && s.secondaryHref && (
                    <ButtonLink href={s.secondaryHref} size="lg" variant="white">
                      {s.secondaryLabel}
                    </ButtonLink>
                  )}
                </div>
                {s.tertiaryLabel && s.tertiaryHref && (
                  <ButtonLink href={s.tertiaryHref} variant="link" className="mt-5 hidden text-white hover:text-orange lg:inline-flex" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    {s.tertiaryLabel}
                  </ButtonLink>
                )}
              </div>
            );
          })}
        </div>

        {/* Artwork, badge and finder card are the desktop hero's; phones get the quick-action tiles. */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <div className="relative">
            <div className="relative grid aspect-square overflow-hidden rounded-2xl">
              {slides.map((s, i) => {
                const on = i === active;
                return (
                  <div
                    key={i}
                    aria-hidden
                    className={cn(
                      "relative col-start-1 row-start-1 overflow-hidden rounded-2xl transition-opacity motion-reduce:transition-none",
                      on ? "opacity-100" : "opacity-0",
                    )}
                    style={{ transitionDuration: `${FADE_MS}ms` }}
                  >
                    {s.imageUrl ? (
                      <SafeImage
                        src={s.imageUrl}
                        alt=""
                        priority={i === 0}
                        // Never shown below lg: the 1px slot keeps phones from downloading a hero photo.
                        sizes="(max-width: 1024px) 1px, 520px"
                        className="rounded-2xl"
                      />
                    ) : (
                      <HeroIllustration className="h-full w-full" />
                    )}
                  </div>
                );
              })}
            </div>

            {badge}

            <div className="animate-fade-up absolute right-0 -bottom-6 flex justify-end motion-reduce:animate-none" style={{ animationDelay: "150ms" }}>
              {finderCard}
            </div>
          </div>
        </div>
      </div>

      {count > 1 && (
        <div className="container-x relative flex items-center gap-3 pb-12 lg:-mt-2 lg:pb-8">
          <div className="flex items-center gap-2" role="group" aria-label="Choose slide">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}: ${s.title.replace(/\[\[|\]\]/g, "")}`}
                aria-current={i === active ? "true" : undefined}
                className="group grid h-11 min-w-11 place-items-center px-1"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-micro ease-soft motion-reduce:transition-none",
                    i === active ? "w-10 bg-orange" : "w-4 bg-white/35 group-hover:bg-white/60",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            {!reduced && (
              <button
                type="button"
                onClick={() => setUserStopped((v) => !v)}
                aria-label={userStopped ? "Start automatic slideshow" : "Pause automatic slideshow"}
                className="grid h-11 w-11 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {userStopped ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
              </button>
            )}
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Previous slide"
              className="grid h-11 w-11 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Next slide"
              className="grid h-11 w-11 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
