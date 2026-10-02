import { useCallback, useEffect, useState } from "react";

/** `75` → `"1:15"`. Minutes are not padded; seconds always are. */
export function formatCountdown(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clampSeconds(sec: number): number {
  return Number.isFinite(sec) ? Math.max(0, Math.ceil(sec)) : 0;
}

export interface Countdown {
  /** Whole seconds left (0 when stopped). */
  remaining: number;
  running: boolean;
  /** `"m:ss"` of `remaining`. */
  label: string;
  /** Starts again from `seconds` (0 stops it). */
  restart: (seconds: number) => void;
}

/**
 * A seconds countdown for resend cooldowns and code expiry.
 *
 * It ticks once a second while it is running and stops on its own at zero (no interval is left
 * behind). Each tick subtracts the wall-clock time that has really passed, so a phone that put the
 * tab to sleep, or a browser that throttled the interval, catches up the moment the page is back
 * instead of resuming where it froze.
 */
export function useCountdown(initialSeconds = 0): Countdown {
  const [remaining, setRemaining] = useState(() => clampSeconds(initialSeconds));
  const running = remaining > 0;

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - last) / 1000);
      if (elapsed < 1) return;
      last += elapsed * 1000;
      setRemaining((r) => Math.max(0, r - elapsed));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const restart = useCallback((seconds: number) => setRemaining(clampSeconds(seconds)), []);

  return { remaining, running, label: formatCountdown(remaining), restart };
}
