import * as React from "react";
import { cn } from "@/lib/utils";
import { Stepper, type StepperStep } from "@/components/ui/misc";

export interface WizardProgressProps {
  steps: StepperStep[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
  /** Show "Next: <label>" beside the counter on phones. Default `true`. */
  showNext?: boolean;
}

/**
 * Wizard header. Below `lg` — where a 360px phone has room for exactly one idea per line — the step
 * reads top to bottom: an orange "STEP 2 OF 5" overline with the next step's name opposite it, one
 * segment per step (filled behind you, orange on the one you are on), then the step's own title and
 * description. A segmented bar beats a continuous one here because the segments ARE the steps: you can
 * see how many are left without reading the counter.
 *
 * Desktop (lg+) keeps the horizontal `Stepper`. Server-component safe — no hooks, no client boundary.
 */
export function WizardProgress({ steps, current, className, showNext = true }: WizardProgressProps) {
  const total = steps.length;
  const index = Math.min(Math.max(current, 0), Math.max(total - 1, 0));
  const step = steps[index];
  const next = steps[index + 1];
  return (
    <div className={className}>
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-overline text-orange" aria-live="polite">
            Step {index + 1} of {total}
          </p>
          {showNext && next && <p className="min-w-0 truncate text-caption text-muted">Next: {next.label}</p>}
        </div>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={Math.max(total, 1)}
          aria-label={`Step ${index + 1} of ${total}`}
        >
          {steps.map((s, i) => (
            <span
              key={s.label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-element motion-reduce:transition-none",
                i < index ? "bg-orange/45" : i === index ? "bg-orange" : "bg-line"
              )}
            />
          ))}
        </div>
        {step && (
          <div className="mt-3">
            <p className="text-h4 text-navy">{step.label}</p>
            {step.description && <p className="mt-0.5 text-body-sm text-muted">{step.description}</p>}
          </div>
        )}
      </div>
      <Stepper steps={steps} current={current} className="hidden lg:flex" />
    </div>
  );
}
