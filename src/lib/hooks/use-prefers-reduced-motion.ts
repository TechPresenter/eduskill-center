import { useMediaQuery } from "./use-media-query";

/**
 * `true` when the OS asks for reduced motion. Use it to skip JS-driven animation
 * (counters, scroll-driven effects); CSS animations are already neutralised globally.
 * Defaults to `false` on the server.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", false);
}
