"use client";

import * as React from "react";
import { LogOut, Timer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { purgeOfflineCaches } from "@/components/pwa/register-sw";
import { BASE_PATH, stripBasePath, withBasePath } from "@/lib/base-path";

/**
 * Automatic sign-out for administrators after a period without activity.
 *
 * The server is the authority: `resolveSessionByToken` ends an administrator session that has not
 * been seen for ADMIN_IDLE_MINUTES. This component keeps the two in step and makes the ending
 * visible instead of a surprise 401:
 *
 *  - real activity (pointer, keyboard, wheel, touch, returning to the tab) is recorded, and shared
 *    across tabs through localStorage, so working in one tab keeps the others signed in;
 *  - while there is activity, POST /api/auth/keepalive is called at most once a minute — always at or
 *    after the latest activity, so the server never times out before this timer does;
 *  - two minutes before the limit a dialog offers "Stay signed in" / "Sign out now";
 *  - at the limit (or when the server says the session is gone) it signs out, clears the PWA caches
 *    exactly like the shell's LogoutButton, tells the other tabs, and opens Secure Admin Login with
 *    `reason` and `next`.
 *
 * Mounted only by the admin layout: never on public pages, the student or the trainer portal.
 */

const WARN_MS = 2 * 60_000;
const PING_EVERY_MS = 60_000;
const TICK_MS = 1_000;
/** Activity events closer together than this are one event (wheel and touch fire in bursts). */
const ACTIVITY_THROTTLE_MS = 1_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

// Namespaced by deployment: two deployments on one domain share localStorage.
const KEY_PREFIX = `esk${BASE_PATH.replace(/\//g, "-")}:admin-idle:`;
const ACTIVITY_KEY = `${KEY_PREFIX}activity`;
const PING_KEY = `${KEY_PREFIX}keepalive`;
const SIGNOUT_KEY = `${KEY_PREFIX}signout`;

type EndReason = "idle" | "expired";

function readNumber(key: string): number {
  try {
    const n = Number(window.localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage blocked (private mode, policy): this tab still times itself out. */
  }
}

function parseReason(value: unknown): EndReason | null {
  return value === "idle" || value === "expired" ? value : null;
}

function formatClock(totalSec: number) {
  const s = Math.max(0, totalSec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function IdleTimeout({ idleMinutes, loginPath, sessionId }: { idleMinutes: number; loginPath: string; sessionId: string }) {
  const idleMsRef = React.useRef(idleMinutes * 60_000);
  const lastActivityRef = React.useRef(0);
  const writtenActivityRef = React.useRef(0);
  const lastPingRef = React.useRef(0);
  const nextPingAllowedRef = React.useRef(0);
  const pingRef = React.useRef<Promise<"ok" | "expired" | "failed"> | null>(null);
  const endingRef = React.useRef(false);
  const warningRef = React.useRef(false);

  const [warning, setWarning] = React.useState(false);
  const [remainingSec, setRemainingSec] = React.useState(0);
  const [announceMinutes, setAnnounceMinutes] = React.useState(2);
  const [staying, setStaying] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    idleMsRef.current = idleMinutes * 60_000;
  }, [idleMinutes]);

  const deadline = React.useCallback(() => lastActivityRef.current + idleMsRef.current, []);

  /** Secure Admin Login, with the page to come back to. A full navigation drops every client cache. */
  const goToLogin = React.useCallback(
    (reason: EndReason | null) => {
      const here = stripBasePath(window.location.pathname) + window.location.search;
      const params = new URLSearchParams();
      if (reason) params.set("reason", reason);
      if (here === "/admin" || here.startsWith("/admin/") || here.startsWith("/admin?")) params.set("next", here);
      const qs = params.toString();
      window.location.replace(withBasePath(`${loginPath}${qs ? `?${qs}` : ""}`));
    },
    [loginPath]
  );

  /**
   * Ends the session in this tab. `remote`: another tab already signed out and cleaned up, so this
   * one only follows it to the login page.
   */
  const endSession = React.useCallback(
    async (reason: EndReason | null, remote = false) => {
      if (endingRef.current) return;
      endingRef.current = true;
      warningRef.current = false;
      if (!remote) {
        let someoneElse = false;
        try {
          // Names THIS tab's session: if the browser has since signed in as someone else (a student
          // on a shared centre computer, after this admin session ran out), the server leaves that
          // newer session alone and says so.
          const res = await api.post<{ skipped?: boolean } | null>("/api/auth/logout", { sessionId }, { signal: AbortSignal.timeout(8_000) });
          someoneElse = res?.skipped === true;
        } catch {
          /* Already signed out, or offline: the session is over either way and login follows. */
        }
        if (someoneElse) {
          // Not this tab's session to clean up after: no cache purge, no sign-out broadcast.
          goToLogin(reason);
          return;
        }
        // The same clean-up the shell's LogoutButton does before the next person signs in.
        window.dispatchEvent(new CustomEvent("esk:logout", { detail: { reason } }));
        purgeOfflineCaches();
        writeStorage(SIGNOUT_KEY, JSON.stringify({ reason, at: Date.now() }));
      }
      goToLogin(reason);
    },
    [goToLogin, sessionId]
  );

  /** Tells the server this person is still here. A ping already in flight is shared, never doubled. */
  const ping = React.useCallback(
    (force = false): Promise<"ok" | "expired" | "failed"> => {
      if (pingRef.current) return pingRef.current;
      if (endingRef.current) return Promise.resolve("failed");
      const startedAt = Date.now();
      if (!force && startedAt < nextPingAllowedRef.current) return Promise.resolve("failed");
      const run = (async () => {
        try {
          const data = await api.post<{ idleMinutes: number }>("/api/auth/keepalive");
          lastPingRef.current = Math.max(lastPingRef.current, startedAt);
          writeStorage(PING_KEY, String(lastPingRef.current));
          if (Number.isFinite(data?.idleMinutes) && data.idleMinutes > 0) idleMsRef.current = data.idleMinutes * 60_000;
          return "ok" as const;
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 401) {
            // Timed out on the server, revoked from the Security Center, or signed out elsewhere.
            void endSession("expired");
            return "expired" as const;
          }
          if (err instanceof ApiClientError && err.status === 403) {
            // The cookie now holds a different account (someone signed in as a student or trainer in
            // another tab after this admin session ended). Leave that session alone: no logout, no
            // cache purge, no sign-out broadcast — just stop showing this admin page.
            endingRef.current = true;
            warningRef.current = false;
            goToLogin("expired");
            return "expired" as const;
          }
          // Offline or rate limited: back off instead of retrying every tick.
          nextPingAllowedRef.current = Date.now() + (err instanceof ApiClientError && err.status === 429 ? 60_000 : 15_000);
          return "failed" as const;
        } finally {
          pingRef.current = null;
        }
      })();
      pingRef.current = run;
      return run;
    },
    [endSession, goToLogin]
  );

  /** One heartbeat: share activity, keep the server alive, open/close the warning, sign out at the limit. */
  const check = React.useCallback(() => {
    if (endingRef.current) return;
    const now = Date.now();
    if (lastActivityRef.current > writtenActivityRef.current) {
      writtenActivityRef.current = lastActivityRef.current;
      writeStorage(ACTIVITY_KEY, String(lastActivityRef.current));
    }
    const remaining = deadline() - now;
    if (remaining <= 0) {
      void endSession("idle");
      return;
    }
    if (remaining <= WARN_MS) {
      if (!warningRef.current) {
        warningRef.current = true;
        setAnnounceMinutes(Math.max(1, Math.round(remaining / 60_000)));
        setWarning(true);
      }
      setRemainingSec(Math.ceil(remaining / 1000));
      return;
    }
    if (warningRef.current) {
      // Activity in another tab pushed the limit back.
      warningRef.current = false;
      setWarning(false);
    }
    // Trailing keep-alive: there was activity since the last ping and that ping is a minute old.
    if (lastActivityRef.current > lastPingRef.current && now - lastPingRef.current >= PING_EVERY_MS) void ping();
  }, [deadline, endSession, ping]);

  React.useEffect(() => {
    const now = Date.now();
    // Loading an admin page is activity. It is NOT a keep-alive: the server only refreshes
    // lastSeenAt on a request when the last write is over a minute old, so the page load may not have
    // moved the server's deadline at all. The trailing-ping rule in check() sends a real keep-alive
    // within a minute instead, which keeps the server's deadline at or after this timer's.
    lastActivityRef.current = Math.max(now, readNumber(ACTIVITY_KEY));
    lastPingRef.current = readNumber(PING_KEY);
    writtenActivityRef.current = lastActivityRef.current;
    writeStorage(ACTIVITY_KEY, String(lastActivityRef.current));

    const onActivity = () => {
      if (endingRef.current) return;
      const t = Date.now();
      if (t - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      // Back after the limit (a sleeping laptop, a throttled background tab): never revive it.
      if (t >= deadline()) {
        void endSession("idle");
        return;
      }
      // While the warning is open only an explicit answer counts — not the Tab key that reaches it.
      if (warningRef.current) return;
      lastActivityRef.current = t;
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      onActivity();
      check();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) check();
    };
    const onStorage = (e: StorageEvent) => {
      // Keys are namespaced; sessionStorage changes never reach other tabs.
      if (!e.key || !e.newValue) return;
      if (e.key === ACTIVITY_KEY) {
        const v = Number(e.newValue);
        if (Number.isFinite(v) && v > lastActivityRef.current) {
          lastActivityRef.current = v;
          writtenActivityRef.current = Math.max(writtenActivityRef.current, v);
        }
      } else if (e.key === PING_KEY) {
        const v = Number(e.newValue);
        if (Number.isFinite(v) && v > lastPingRef.current) lastPingRef.current = v;
      } else if (e.key === SIGNOUT_KEY) {
        let reason: EndReason | null = null;
        try {
          reason = parseReason((JSON.parse(e.newValue) as { reason?: unknown }).reason);
        } catch {
          reason = null;
        }
        void endSession(reason, true);
      }
    };
    // The shell's LogoutButton (or the API client after a 401) signed this tab out: take the others along.
    const onLogout = (e: Event) => {
      if (endingRef.current) return;
      endingRef.current = true;
      warningRef.current = false;
      const reason = parseReason((e as CustomEvent<{ reason?: unknown } | null>).detail?.reason);
      writeStorage(SIGNOUT_KEY, JSON.stringify({ reason, at: Date.now() }));
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, opts);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    window.addEventListener("esk:logout", onLogout);
    const timer = window.setInterval(check, TICK_MS);
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity, opts);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("esk:logout", onLogout);
      window.clearInterval(timer);
    };
  }, [check, deadline, endSession]);

  const stay = async () => {
    if (endingRef.current || staying) return;
    setStaying(true);
    const now = Date.now();
    lastActivityRef.current = now;
    writtenActivityRef.current = now;
    writeStorage(ACTIVITY_KEY, String(now));
    const result = await ping(true);
    if (result === "expired") return; // endSession is already taking this tab to the login page
    warningRef.current = false;
    setWarning(false);
    setStaying(false);
    if (result === "failed") toast.error("Could not reach the server. Check your connection, or you may be signed out.");
  };

  const signOutNow = () => {
    if (endingRef.current) return;
    setLeaving(true);
    void endSession(null);
  };

  const warnTotalSec = Math.round(WARN_MS / 1000);
  const pct = Math.max(0, Math.min(100, (remainingSec / warnTotalSec) * 100));

  return (
    <Modal
      open={warning}
      onClose={() => void stay()}
      size="sm"
      title="Your session is about to end"
      description={`For your security, administrators are signed out after ${idleMinutes} minutes without activity. You will be signed out in about ${announceMinutes} minute${announceMinutes === 1 ? "" : "s"}.`}
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={signOutNow} loading={leaving} disabled={staying} leftIcon={<LogOut className="size-4" aria-hidden />}>
            Sign out now
          </Button>
          <Button type="button" variant="primary" size="md" onClick={() => void stay()} loading={staying} disabled={leaving}>
            Stay signed in
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-warning-light text-warning-dark" aria-hidden>
          <Timer className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm text-muted">Signing out in</p>
          {/* role="timer" is not a live region: the countdown is never read out every second. */}
          <p role="timer" className="font-heading text-h2 text-navy tabular-nums">
            {formatClock(remainingSec)}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line/70" aria-hidden>
        <div className="duration-element h-full rounded-full bg-warning transition-[width] ease-linear motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-4 text-body-sm text-muted">Unsaved changes on this page will be lost if you are signed out.</p>
    </Modal>
  );
}
