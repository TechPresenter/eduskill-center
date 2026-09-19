import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One of the seven steps of the EduSkill Shiksha Mission centre process.
 * Shaped exactly like the entries of `CENTRE_STEPS` in `src/server/centre-applications.ts`,
 * which server pages pass down (the constant itself lives with the service and must not be duplicated).
 */
export interface CentreStepItem {
  step: number;
  title: string;
  description: string;
}

export interface CentreStepsProps {
  steps: readonly CentreStepItem[];
  /** Step currently in progress (1–7). `0`/undefined highlights nothing (public explainer). */
  current?: number;
  /** Highest finished step (1–7). Defaults to `current - 1`; pass `1` on the submitted screen. */
  completed?: number;
  /** `sm` tightens the spacing for cards inside the apply / status screens. */
  size?: "md" | "sm";
  /** Small "Done" / "Current step" pills. Default `true` when a current or completed step is given. */
  showState?: boolean;
  className?: string;
}

/**
 * The seven-step "how to open a centre" process as a vertical numbered timeline.
 * Pure presentation with serialisable props, so the landing page (server), the apply success screen
 * and the public status tracker (both client) all render the same thing.
 */
export function CentreSteps({ steps, current = 0, completed, size = "md", showState, className }: CentreStepsProps) {
  const doneThrough = completed ?? (current > 0 ? current - 1 : 0);
  const withState = showState ?? (current > 0 || (completed ?? 0) > 0);
  const compact = size === "sm";

  return (
    <ol className={cn("relative", className)}>
      {steps.map((s, i) => {
        const done = s.step <= doneThrough;
        const active = !done && s.step === current;
        const last = i === steps.length - 1;
        return (
          <li key={s.step} className={cn("relative flex gap-4", last ? "pb-0" : compact ? "pb-5" : "pb-7 sm:pb-8")}>
            {!last && (
              <span
                aria-hidden
                className={cn("absolute top-11 left-5 w-0.5 -translate-x-1/2", compact ? "bottom-1" : "bottom-2", done ? "bg-orange/60" : "bg-line")}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-base font-extrabold transition-colors",
                done
                  ? "bg-orange text-white shadow-card"
                  : active
                    ? "border-2 border-orange bg-white text-orange ring-4 ring-orange/15"
                    : "border-2 border-line bg-white text-muted"
              )}
            >
              {done ? <Check className="h-5 w-5" strokeWidth={3} /> : s.step}
            </span>
            <div className={cn("min-w-0 flex-1", compact ? "pt-1.5" : "pt-1")} aria-current={active ? "step" : undefined}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className={cn("font-bold text-navy", compact ? "text-[15px]" : "text-base sm:text-lg")}>
                  <span className="sr-only">Step {s.step}: </span>
                  {s.title}
                </h3>
                {withState && done && (
                  <span className="inline-flex items-center rounded-full bg-success-light px-2 py-0.5 text-xs font-semibold text-green-700">Done</span>
                )}
                {withState && active && (
                  <span className="inline-flex items-center rounded-full bg-orange px-2 py-0.5 text-xs font-semibold text-white">Current step</span>
                )}
              </div>
              <p className={cn("mt-1 leading-relaxed text-muted", compact ? "text-sm" : "text-[15px]")}>{s.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
