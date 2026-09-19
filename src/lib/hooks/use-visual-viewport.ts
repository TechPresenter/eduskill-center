import * as React from "react";

export interface VisualViewportState {
  /** The on-screen keyboard is (very likely) open: an editable control has focus and the viewport lost 25%+ of its height. */
  keyboardOpen: boolean;
  /** Current visual viewport height in CSS px (0 on the server). */
  height: number;
}

const SERVER_STATE: VisualViewportState = { keyboardOpen: false, height: 0 };
let state: VisualViewportState = SERVER_STATE;
let baselineHeight = 0;
let baselineWidth = 0;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

/** Inputs that open a picker or nothing at all instead of a text keyboard. */
const NON_TEXT_INPUTS = new Set(["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden", "date", "time", "datetime-local", "month", "week"]);

function isEditableFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return false;
}

function read(): VisualViewportState {
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const width = Math.round(vv?.width ?? window.innerWidth);
  // The baseline is the tallest viewport seen at the current width (reset on rotation / resize),
  // which keeps the heuristic valid under both interactive-widget=resizes-visual and resizes-content.
  if (width !== baselineWidth) {
    baselineWidth = width;
    baselineHeight = height;
  } else if (height > baselineHeight) {
    baselineHeight = height;
  }
  const keyboardOpen = baselineHeight > 0 && height < baselineHeight * 0.75 && isEditableFocused();
  return { keyboardOpen, height };
}

function refresh(): VisualViewportState {
  const next = read();
  if (next.height !== state.height || next.keyboardOpen !== state.keyboardOpen) state = next;
  return state;
}

function notify() {
  const prev = state;
  refresh();
  if (state !== prev) listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!detach) {
    const vv = window.visualViewport;
    vv?.addEventListener("resize", notify);
    window.addEventListener("resize", notify);
    window.addEventListener("orientationchange", notify);
    document.addEventListener("focusin", notify);
    document.addEventListener("focusout", notify);
    detach = () => {
      vv?.removeEventListener("resize", notify);
      window.removeEventListener("resize", notify);
      window.removeEventListener("orientationchange", notify);
      document.removeEventListener("focusin", notify);
      document.removeEventListener("focusout", notify);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

const getSnapshot = () => (typeof window === "undefined" ? SERVER_STATE : refresh());
const getServerSnapshot = () => SERVER_STATE;

/**
 * Tracks the visual viewport so fixed bottom chrome (BottomNav, StickyActionBar, Fab, Toaster)
 * can hide while the on-screen keyboard is open instead of floating over the form.
 * One shared listener set serves every subscriber; the snapshot object is stable between changes.
 */
export function useVisualViewport(): VisualViewportState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Convenience: `useVisualViewport().keyboardOpen`. */
export function useKeyboardOpen(): boolean {
  return useVisualViewport().keyboardOpen;
}
