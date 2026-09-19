/**
 * Client-side hooks shared by the UI kit, the portal shell and page slices.
 * Import from "@/lib/hooks"; every hook is SSR-safe (server snapshot defaults documented per hook).
 */
export { useMediaQuery, useIsDesktop, useIsCoarsePointer, DESKTOP_QUERY, COARSE_POINTER_QUERY } from "./use-media-query";
export { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
export { useScrollLock } from "./use-scroll-lock";
export { useFocusTrap, getFocusable, type FocusTrapOptions } from "./use-focus-trap";
export { useVisualViewport, useKeyboardOpen, type VisualViewportState } from "./use-visual-viewport";
export { useScrollIntoViewOnFocus, type ScrollIntoViewOnFocusOptions } from "./use-scroll-into-view-on-focus";
