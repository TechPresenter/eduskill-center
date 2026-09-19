"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

let items: ToastItem[] = [];
let counter = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function push(variant: ToastVariant, title: string, description?: string, duration = 5000) {
  const id = counter++;
  items = [...items, { id, title, description, variant, duration }];
  emit();
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description, 7000),
  info: (title: string, description?: string) => push("info", title, description),
  warning: (title: string, description?: string) => push("warning", title, description),
  dismiss,
};

const ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastVariant, string> = {
  success: "border-success/30 [&_svg.icon]:text-success",
  error: "border-danger/30 [&_svg.icon]:text-danger",
  info: "border-info/30 [&_svg.icon]:text-info",
  warning: "border-warning/30 [&_svg.icon]:text-warning",
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Toast outlet (mounted once in the root layout). On phones the stack sits just above the bottom nav /
 * sticky action bar / gesture bar (reads the --bottom-nav-h and --sticky-bar-h variables the shell and
 * StickyActionBar set on :root) and slides up; on sm+ it docks bottom-right and slides in from the right.
 */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && items.length) dismiss(items[items.length - 1]!.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (list.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 z-[100] flex flex-col items-end gap-2 bottom-[calc(var(--bottom-nav-h)+var(--sticky-bar-h)+env(safe-area-inset-bottom,0px)+1rem)] sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {list.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-card-hover animate-slide-up sm:animate-slide-in-right motion-reduce:animate-none",
              STYLES[t.variant]
            )}
          >
            <Icon className="icon mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 py-0.5">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
            </div>
            <IconButton size="sm" variant="ghost" aria-label="Dismiss notification" icon={<X className="h-4 w-4" />} onClick={() => dismiss(t.id)} className="-m-2 sm:-m-1.5" />
          </div>
        );
      })}
    </div>
  );
}
