import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CentreStep {
  step: number;
  title: string;
  description: string;
}

/**
 * The seven-step Shiksha Mission process. Vertical list on phones (each row a 44px-tall
 * labelled item) and a horizontal rail from `md` up. Server-safe: plain markup, no state.
 */
export function StepProgress({ steps, current, rejected, className }: { steps: readonly CentreStep[]; current: number; rejected?: boolean; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-3 md:flex-row md:items-start md:gap-0", className)}>
      {steps.map((s, i) => {
        const done = s.step < current;
        const active = s.step === current;
        return (
          <li key={s.step} className="flex min-h-11 flex-1 items-start gap-3 md:flex-col md:items-center md:text-center">
            <div className="flex items-center md:w-full">
              <span aria-hidden className={cn("hidden h-0.5 flex-1 md:block", done || active ? "bg-orange" : "bg-line", i === 0 && "invisible")} />
              <span
                aria-hidden
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  rejected && active
                    ? "border-danger bg-danger text-white"
                    : done
                      ? "border-orange bg-orange text-white"
                      : active
                        ? "border-orange bg-white text-orange"
                        : "border-line bg-white text-muted"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.step}
              </span>
              <span aria-hidden className={cn("hidden h-0.5 flex-1 md:block", done ? "bg-orange" : "bg-line", i === steps.length - 1 && "invisible")} />
            </div>
            <div className="min-w-0 md:mt-2 md:px-1.5">
              <p className={cn("text-sm font-semibold", active || done ? "text-navy" : "text-muted")}>
                {s.title}
                {active && <span className="sr-only"> (current step)</span>}
              </p>
              <p className="text-xs text-muted md:hidden lg:block">{s.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
