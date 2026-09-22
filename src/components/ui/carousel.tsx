"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";
import { CAROUSEL_SLIDE_STYLE, basePerView, carouselTrackStyle, scrollToStop, useCarousel, type SlidesPerView } from "./carousel-hooks";

export type { SlidesPerView, CarouselBreakpoint } from "./carousel-hooks";

/** Above this many snap stops the dot row becomes a compact "3 / 14" counter instead of overflowing. */
const MAX_DOTS = 10;

export interface CarouselProps {
  /** One node per slide. Wrap each in `<CarouselSlide>` for the full-height card padding, or pass cards directly. */
  children: React.ReactNode;
  /** Required: names the carousel for screen readers ("Featured courses"). */
  "aria-label": string;
  /**
   * Slides visible at once — a number, or per breakpoint with forward fill:
   * `{ base: 1.15, sm: 2, lg: 3 }`. Fractional values peek the next card, which is what makes a
   * phone carousel read as swipeable without any arrows.
   */
  slidesPerView?: SlidesPerView;
  /** Gap between slides as a Tailwind spacing step (`4` → 1rem). Default `4`. */
  gap?: number;
  /** Autoplay interval in ms, or `false` (default). Never runs under `prefers-reduced-motion`. */
  autoPlay?: number | false;
  /** Wrap around at the ends: arrows stay enabled and autoplay restarts from the first slide. */
  loop?: boolean;
  /** Pause autoplay while a mouse is over the carousel. Default `true`. */
  pauseOnHover?: boolean;
  /** Stop autoplay for good after a swipe, arrow, dot or arrow-key interaction. Default `true`. */
  pauseOnInteraction?: boolean;
  /** Prev/next buttons. Default `true`. */
  showArrows?: boolean;
  /**
   * `"overlay"` (default) floats the arrows over the left/right edge of the track and hides them below
   * `sm`, where they would crowd the cards and swiping is better anyway. `"top"` puts them in a row
   * above the track at every width.
   */
  arrowPlacement?: "overlay" | "top";
  /** Dot indicators. Default `true`. */
  showDots?: boolean;
  /** Thin autoplay progress bar. Defaults to `true` when `autoPlay` is set. */
  showProgress?: boolean;
  /** Play/pause toggle, required by WCAG 2.2.2 whenever content moves on its own. Default `true`. */
  showPlayPause?: boolean;
  /** `scroll-snap-stop: always` — one slide per flick instead of letting momentum run on. */
  snapStop?: boolean;
  /** `"on-dark"` recolours the dots, counter, progress track and play/pause for a navy section. */
  tone?: "default" | "on-dark";
  /** Snap stop to open on (jumps without animation). */
  startIndex?: number;
  /** Fires with the first visible slide index whenever the active stop changes. */
  onSlideChange?: (index: number) => void;
  className?: string;
  /** Extra classes for the scrolling track (e.g. more vertical padding for taller shadows). */
  trackClassName?: string;
}

/**
 * Scroll-snap carousel: no dependencies, native touch physics, accessible controls.
 *
 * The track is a real horizontal scroller (`overflow-x: auto` + `scroll-snap-type: x mandatory`), so a
 * swipe is the browser's own gesture — momentum, rubber-banding and snapping all come for free, and the
 * component never intercepts a pointer. React only adds the things CSS cannot do: prev/next buttons that
 * disable at the ends, dots driven by the measured scroll position, autoplay that knows when to stop, and
 * the APG carousel semantics.
 *
 * Accessibility: `role="region"` + `aria-roledescription="carousel"`, each slide a labelled
 * `role="group"` ("3 of 8"), `aria-live` on the track that switches to `off` while autoplaying,
 * a visually hidden usage hint, arrow/Home/End keys, a focusable track so keyboard users can reach
 * slides with no interactive content, and focus inside a slide scrolls that slide into view.
 * Autoplay is disabled outright under `prefers-reduced-motion`, and pauses on hover, on focus,
 * on interaction, while the page is hidden and while the carousel is off-screen.
 *
 * ```tsx
 * <Carousel aria-label="Featured courses" slidesPerView={{ base: 1.12, sm: 2, lg: 3 }} autoPlay={6000} loop>
 *   {courses.map((c) => (
 *     <CarouselSlide key={c.id}>
 *       <article className="card card-hover h-full p-5">…</article>
 *     </CarouselSlide>
 *   ))}
 * </Carousel>
 * ```
 */
export function Carousel({
  children,
  "aria-label": ariaLabel,
  slidesPerView = 1,
  gap = 4,
  autoPlay = false,
  loop = false,
  pauseOnHover = true,
  pauseOnInteraction = true,
  showArrows = true,
  arrowPlacement = "overlay",
  showDots = true,
  showProgress,
  showPlayPause = true,
  snapStop = false,
  tone = "default",
  startIndex,
  onSlideChange,
  className,
  trackClassName,
}: CarouselProps) {
  const slides = React.Children.toArray(children);
  const count = slides.length;
  const autoPlayMs = typeof autoPlay === "number" && autoPlay > 0 ? Math.max(1200, Math.round(autoPlay)) : 0;
  const hintId = React.useId();

  const { rootRef, trackRef, metrics, goTo, next, prev, autoPlayEnabled, running, stopped, toggle, tick, rootHandlers } = useCarousel({
    count,
    ssrPerView: basePerView(slidesPerView),
    loop,
    autoPlayMs,
    pauseOnHover,
    pauseOnInteraction,
    onSlideChange,
  });
  const { index, stops, atStart, atEnd } = metrics;

  // Open on a given stop without animating (deep links, "continue where you left off").
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track || !startIndex) return;
    scrollToStop(track, startIndex, "instant");
  }, [startIndex, trackRef]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    // Never hijack arrow keys from a control that needs them itself.
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next(true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev(true);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(stops - 1, true);
    }
  };

  // Tabbing into a slide that is off to the side: re-align it instead of leaving a half-scrolled track.
  const onTrackFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const target = e.target as HTMLElement;
    if (!track || target === track) return;
    const slide = target.closest<HTMLElement>("[data-carousel-slide]");
    if (!slide || slide.parentElement !== track) return;
    const trackBox = track.getBoundingClientRect();
    const slideBox = slide.getBoundingClientRect();
    if (slideBox.left >= trackBox.left - 1 && slideBox.right <= trackBox.right + 1) return; // already fully visible
    goTo(Number(slide.dataset.index ?? 0));
  };

  const onDark = tone === "on-dark";
  const canScroll = count > 1 && stops > 1;
  const arrowsVisible = showArrows && canScroll;
  const withProgress = (showProgress ?? true) && autoPlayEnabled && canScroll;
  const withPlayPause = showPlayPause && autoPlayEnabled && canScroll;
  const withDots = showDots && canScroll;

  const arrows = (overlay: boolean) => (
    <>
      <IconButton
        aria-label="Previous slide"
        icon={<ChevronLeft className="h-5 w-5" />}
        onClick={() => prev(true)}
        disabled={!loop && atStart}
        className={cn(
          "rounded-full border border-line bg-white text-navy shadow-e1 transition-colors duration-micro motion-reduce:transition-none hover:border-orange/40 hover:text-orange",
          // Opaque, never blurred: backdrop-filter costs a full-screen GPU pass and makes the button a
          // containing block for any position:fixed descendant.
          overlay && "absolute top-1/2 left-1 z-raised hidden -translate-y-1/2 bg-white sm:inline-flex disabled:opacity-0"
        )}
      />
      <IconButton
        aria-label="Next slide"
        icon={<ChevronRight className="h-5 w-5" />}
        onClick={() => next(true)}
        disabled={!loop && atEnd}
        className={cn(
          "rounded-full border border-line bg-white text-navy shadow-e1 transition-colors duration-micro motion-reduce:transition-none hover:border-orange/40 hover:text-orange",
          overlay && "absolute top-1/2 right-1 z-raised hidden -translate-y-1/2 bg-white sm:inline-flex disabled:opacity-0"
        )}
      />
    </>
  );

  return (
    <section
      ref={rootRef as React.Ref<HTMLElement>}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      aria-describedby={canScroll ? hintId : undefined}
      className={cn("relative", className)}
      onKeyDown={onKeyDown}
      {...rootHandlers}
    >
      {canScroll && (
        <p id={hintId} className="sr-only">
          Carousel with {count} slides. Swipe, or use the previous and next buttons and the left and right arrow keys, to move between slides.
        </p>
      )}

      {arrowsVisible && arrowPlacement === "top" && <div className="mb-3 flex items-center justify-end gap-2">{arrows(false)}</div>}

      {/* Wrapper so the overlay arrows centre on the slides, not on the region (which also holds the dots). */}
      <div className="relative">
        <div
          ref={trackRef}
          data-carousel-track=""
          tabIndex={0}
          aria-live={running ? "off" : "polite"}
          onFocus={onTrackFocus}
          style={carouselTrackStyle(slidesPerView, gap)}
          className={cn(
            // A scroll container clips at its padding box, so the padding is the room the card shadows and
            // focus rings need: 4px inline is exactly the horizontal reach of shadow-card-hover, and py-3.5
            // covers the vertical reach plus the hover lift. The matching -my-3.5 gives that vertical room
            // back to the layout, so the carousel is no taller than the cards themselves. There is
            // deliberately no -mx counterpart: it would push the track outside a full-bleed parent and widen
            // the page. Inside a padded container, `trackClassName="-mx-1"` pulls the slides flush again.
            "no-scrollbar relative -my-3.5 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-px-1 px-1 py-3.5",
            "rounded-card focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-0 focus-visible:outline-none",
            trackClassName
          )}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              data-carousel-slide=""
              data-index={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              className={cn("min-w-0 snap-start", snapStop && "snap-always")}
              style={CAROUSEL_SLIDE_STYLE}
            >
              {slide}
            </div>
          ))}
        </div>

        {arrowsVisible && arrowPlacement === "overlay" && arrows(true)}
      </div>

      {withProgress && (
        <div className={cn("mt-4 h-0.75 w-full overflow-hidden rounded-full", onDark ? "bg-white/25" : "bg-line/70")} aria-hidden>
          <span
            key={`${index}:${tick}:${running}`}
            className="block h-full w-full origin-left rounded-full bg-orange"
            style={{ animation: `cr-progress ${autoPlayMs}ms linear forwards`, animationPlayState: running ? "running" : "paused" }}
          />
        </div>
      )}

      {(withDots || withPlayPause) && (
        <div className={cn("flex items-center justify-center gap-2", withProgress ? "mt-1" : "mt-4")}>
          {withPlayPause && (
            <IconButton
              size="sm"
              aria-label={stopped ? "Start the slideshow" : "Pause the slideshow"}
              icon={stopped ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              onClick={toggle}
              className={onDark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-muted hover:text-navy"}
            />
          )}
          {withDots &&
            (stops > MAX_DOTS ? (
              <p className={cn("min-h-11 px-2 text-body-sm leading-11 font-semibold tabular-nums", onDark ? "text-white/80" : "text-muted")}>
                {index + 1} / {stops}
              </p>
            ) : (
              <div className="flex items-center justify-center">
                {Array.from({ length: stops }, (_, i) => {
                  const active = i === index;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i, true)}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={active ? "true" : undefined}
                      className="group flex h-11 w-11 items-center justify-center tap-highlight-none"
                    >
                      <span
                        className={cn(
                          "block h-2 rounded-full transition-all duration-micro motion-reduce:transition-none",
                          active ? "w-5 bg-orange" : onDark ? "w-2 bg-white/35 group-hover:bg-white/60" : "w-2 bg-navy/20 group-hover:bg-navy/40"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

/**
 * Optional slide wrapper: stretches to the tallest slide so `card h-full` children line up, and gives
 * you one place to hang per-slide classes. Passing a card straight to `<Carousel>` works too.
 */
export function CarouselSlide({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex h-full flex-col", className)} {...props}>
      {children}
    </div>
  );
}
