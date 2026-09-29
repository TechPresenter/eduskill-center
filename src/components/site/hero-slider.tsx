"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import Image from "next/image";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

export interface HeroSlideData {
  eyebrow?: string;
  title: string;
  /** Optional short title for phones (≤ 2 lines). Falls back to the first line of `title`. */
  mobileTitle?: string;
  subtitle?: string;
  /** Lavender pill under the headline — who is running this (e.g. the mission the slide is about). */
  pillText?: string;
  /** One orange line: the single most useful fact about this slide. */
  emphasis?: string;
  /** Programmes/classes on this slide, separated by "|". */
  programLine?: string;
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
 * full CMS title (its line breaks honoured) from lg.
 *
 * The desktop step is smaller than it was, because the editorial column is: the hero now runs
 * copy / figure / enquiry card across twelve columns instead of copy / artwork across seven and
 * five, so the headline lives in five columns and 36–42px is what keeps the seeded three CMS lines
 * to three lines there.
 */
export function HeroTitle({ title, mobileTitle }: { title: string; mobileTitle?: string }) {
  return (
    // Both renderings are white-on-navy by construction — every caller paints onto the hero's dark
    // navy bed — so the [[…]] accent is fixed to the on-navy orange (4.56:1 on navy, more on
    // navy-dark) rather than the light-surface text-orange, which measures 2.28:1 on the brand blue.
    <h1 className="text-white">
      <span className="block text-h1 text-balance lg:hidden">
        <Highlight text={phoneTitle(title, mobileTitle)} highlightClassName="text-orange-on-navy" />
      </span>
      {/* The copy column widened when the illustration was dropped, so the headline can carry the
          hero on its own. The accent keeps `text-orange-on-navy` (4.56:1 on navy) — a gradient fill
          here would look richer and fail contrast, which is not a trade worth making. */}
      <span className="hidden font-heading text-[1.875rem] leading-[1.08] font-extrabold tracking-[-0.02em] text-balance [text-shadow:0_2px_24px_rgb(0_0_0/0.25)] lg:block xl:text-[2.25rem]">
        <Highlight text={title} highlightClassName="text-orange-on-navy" />
      </span>
    </h1>
  );
}

const HERO_SUBJECT = "/image-eduskill.png";

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

/** One slide's editorial column, in the reference's order: headline, pill, offer, programmes, CTA. */
function SlideCopy({ slide }: { slide: HeroSlideData }) {
  return (
    <>
      {/* `eyebrow-on-navy`, not `eyebrow` + a colour: the slide sits on the navy bed, where plain
          text-orange is 2.28:1 at 12px/700. */}
      {slide.eyebrow && <p className="eyebrow-on-navy mb-1.5 lg:mb-2">{slide.eyebrow}</p>}
      <HeroTitle title={slide.title} mobileTitle={slide.mobileTitle} />

      {slide.pillText && (
        // The reference's light pill naming the institution. navy on lavender is 7.09:1.
        <p className="mt-2.5 inline-flex max-w-full items-center rounded-full bg-lavender px-3 py-1 text-body-sm font-bold text-navy lg:mt-3">{slide.pillText}</p>
      )}

      {slide.emphasis && <p className="mt-2.5 text-body-sm font-semibold text-orange-on-navy lg:text-body">{slide.emphasis}</p>}

      {slide.programLine && <p className="mt-2 text-body-sm font-bold text-white">{slide.programLine}</p>}

      {slide.subtitle && <p className="mt-2.5 line-clamp-3 max-w-xl text-body-sm text-white/80 lg:mt-3 lg:line-clamp-2">{slide.subtitle}</p>}

      {/* On phones a slide's own CTA is one compact link; the solid button row is desktop's. */}
      {slide.primaryLabel && slide.primaryHref && (
        // Hover lands on orange-on-navy (4.56:1), not orange (2.28:1): a hover state is still text,
        // and a link that becomes unreadable when you point at it is backwards.
        <ButtonLink href={slide.primaryHref} variant="link" className="mt-3 min-h-11 text-white hover:text-orange-on-navy lg:hidden" rightIcon={<ArrowRight className="h-4 w-4" />}>
          {slide.primaryLabel}
        </ButtonLink>
      )}
      <div className="mt-5 hidden flex-wrap gap-3 lg:flex lg:items-center">
        {slide.primaryLabel && slide.primaryHref && (
          <ButtonLink href={slide.primaryHref} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
            {slide.primaryLabel}
          </ButtonLink>
        )}
        {slide.secondaryLabel && slide.secondaryHref && (
          <ButtonLink href={slide.secondaryHref} size="lg" variant="white">
            {slide.secondaryLabel}
          </ButtonLink>
        )}
      </div>
      {slide.tertiaryLabel && slide.tertiaryHref && (
        <ButtonLink href={slide.tertiaryHref} variant="link" className="mt-4 hidden text-white hover:text-orange-on-navy lg:inline-flex" rightIcon={<ArrowRight className="h-4 w-4" />}>
          {slide.tertiaryLabel}
        </ButtonLink>
      )}
    </>
  );
}

/**
 * The homepage hero as a cross-fading slider, laid out as a three-part split: editorial copy left,
 * the cut-out subject in the middle, the enquiry card right.
 *
 * ZERO LAYOUT SHIFT. Every slide's copy occupies THE SAME CSS grid cell (`col-start-1 row-start-1`)
 * rather than being absolutely positioned, so the column is as tall as the longest slide and the
 * page never jumps as slides change — no measuring, no reserved magic number. The subject layer is
 * absolutely positioned and therefore contributes no height at all. A scroll-snap carousel would be
 * the wrong tool: a hero wants a fade, and its content must not be reachable by horizontal scroll.
 *
 * WHAT MOVES AND WHAT STAYS. The copy and the subject belong to the slide and cross-fade with it.
 * The enquiry card is functional furniture, not editorial, so it is passed
 * in as nodes and stay put while the story behind them changes — a form that reset or re-rendered
 * every seven seconds would be unusable.
 */
export function HeroSlider({
  slides,
  form,
}: {
  slides: HeroSlideData[];
  /** The enquiry card. Rendered once, outside the fading cell. */
  form?: React.ReactNode;
  /** The trust-badge card. Rendered once, under the copy on lg+ and after the form on phones. */
}) {
  const count = slides.length;
  // One slide is not a carousel. Without this the hero would announce "carousel, slide 1 of 1" and
  // mark its only slide as a `role="group"` slide — which is exactly the single static banner this
  // hero has always been for a Foundation that has not added a second slide in Admin → CMS.
  const isCarousel = count > 1;
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

  // Touch swipe. Horizontal intent only, so a vertical page scroll is never hijacked. Bound to the
  // editorial column, never to the whole hero: a swipe that started inside the enquiry form must
  // not change the slide under the visitor's hands.
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
      role={isCarousel ? "region" : undefined}
      aria-roledescription={isCarousel ? "carousel" : undefined}
      aria-label={isCarousel ? "Highlights" : undefined}
      className="relative"
      onKeyDown={isCarousel ? onKeyDown : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      {isCarousel && (
        <p className="sr-only">
          Slide {active + 1} of {count}. Use the left and right arrow keys to change slide.
        </p>
      )}

      <div className="container-x relative pt-5 pb-6 sm:pt-6 lg:pt-9 lg:pb-7">
        <div className="relative grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-6">
          {/*
            The cut-out subject. Absolutely positioned between the two columns from lg, so it adds no
            height and can overhang whatever it likes. Its percentage box was chosen so the drawn
            figure (which fills the middle ~57% of its own canvas) lands in the gutter between the
            copy and the card at every width from 1024 up — verified at 1024 and 1440.
          */}
          <div className="pointer-events-none absolute inset-y-0 left-[34%] hidden w-[29%] lg:block xl:left-[36%] xl:w-[27%]" aria-hidden>
            {/* Glow behind the subject so the cut-out sits in the scene instead of floating flatly
                on the navy. Sized generously and blurred hard; it is decoration, never a shape. */}
            <span className="absolute bottom-0 left-1/2 h-[78%] w-[115%] -translate-x-1/2 rounded-full bg-orange/18 blur-[90px]" />
            <span className="absolute bottom-0 left-1/2 h-[46%] w-[70%] -translate-x-1/2 rounded-full bg-white/10 blur-[70px]" />
            <div className="relative grid h-full">
              {slides.map((s, i) => (
                <div
                  key={i}
                  className={cn("col-start-1 row-start-1 h-full transition-opacity motion-reduce:transition-none", i === active ? "opacity-100" : "opacity-0")}
                  style={{ transitionDuration: `${FADE_MS}ms` }}
                >
                  {/* A transparent-background cut-out, bottom-aligned so it stands on the hero's
                      baseline and may overhang. `object-bottom` keeps her feet on that line at any
                      height; `object-contain` stops the crop distorting at narrow widths. A slide
                      can override the subject from Admin → CMS. */}
                  <Image
                    src={withBasePath(s.imageUrl || HERO_SUBJECT)}
                    alt=""
                    fill
                    priority={i === 0}
                    sizes="(max-width: 1024px) 1px, 34vw"
                    className="object-contain object-bottom drop-shadow-[0_24px_48px_rgb(0_0_0/0.45)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/*
            The subject on phones and tablets. The lg layer above is absolutely positioned in the
            gutter between two columns, which does not exist below lg — so rather than stretch that
            one, this is its own flow block between the copy and the form. It costs height, which is
            the trade for having her visible at all on a phone; `h-52` keeps that cost bounded.
          */}
          <div className="relative order-2 -mb-6 h-52 sm:h-60 lg:hidden" aria-hidden>
            <span className="absolute bottom-0 left-1/2 h-[70%] w-[78%] -translate-x-1/2 rounded-full bg-orange/20 blur-[70px]" />
            <div className="relative grid h-full">
              {slides.map((s, i) => (
                <div
                  key={i}
                  className={cn("col-start-1 row-start-1 h-full transition-opacity motion-reduce:transition-none", i === active ? "opacity-100" : "opacity-0")}
                  style={{ transitionDuration: `${FADE_MS}ms` }}
                >
                  <Image
                    src={withBasePath(s.imageUrl || HERO_SUBJECT)}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 60vw, 1px"
                    className="object-contain object-bottom drop-shadow-[0_16px_32px_rgb(0_0_0/0.4)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/*
            Editorial column. Every slide occupies the same grid cell, so the column is as tall as the
            longest slide and nothing reflows on change. `z-10` keeps the copy above the subject layer
            for the few pixels where they meet.
          */}
          <div
            className="relative z-10 order-1 grid lg:order-none lg:col-span-5 lg:row-start-1"
            aria-live={isCarousel && manual && !autoplayOn ? "polite" : "off"}
            onTouchStart={isCarousel ? onTouchStart : undefined}
            onTouchEnd={isCarousel ? onTouchEnd : undefined}
          >
            {slides.map((s, i) => {
              const on = i === active;
              return (
                <div
                  key={i}
                  // Stack every slide in the single grid cell at row 1 / column 1.
                  className={cn("col-start-1 row-start-1 transition-opacity motion-reduce:transition-none", on ? "opacity-100" : "pointer-events-none opacity-0")}
                  style={{ transitionDuration: `${FADE_MS}ms` }}
                  role={isCarousel ? "group" : undefined}
                  aria-roledescription={isCarousel ? "slide" : undefined}
                  aria-label={isCarousel ? `${i + 1} of ${count}` : undefined}
                  aria-hidden={!on}
                  // Keeps Tab out of the slides that are faded out.
                  inert={!on}
                >
                  <SlideCopy slide={s} />
                </div>
              );
            })}
          </div>

          {/*
            Enquiry card. Second on phones (straight after the copy, so the form is the first thing
            below the fold), right-hand column from lg. `self-start` rather than a stretched
            row-span: the card should keep its own height, not be pulled taller by the badge row.
          */}
          {form && <div className="relative z-10 order-3 lg:order-none lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:self-start">{form}</div>}

        </div>
      </div>

      {count > 1 && (
        <div className="container-x relative flex items-center gap-3 pb-5 lg:pb-6">
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
