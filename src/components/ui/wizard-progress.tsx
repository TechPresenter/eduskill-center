import * as React from "react";
import { Stepper, type StepperStep } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/stats";

export interface WizardProgressProps {
  steps: StepperStep[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
  /** Show "Next: <label>" beside the counter on phones. Default `true`. */
  showNext?: boolean;
}

/**
 * Wizard header. Phones/tablets (< lg): "Step X of N", an orange progress bar and the current step's
 * label. Desktop (lg+): the existing horizontal `Stepper`. Server-component safe.
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
          <p className="text-meta font-semibold uppercase tracking-wide text-muted" aria-live="polite">
            Step {index + 1} of {total}
          </p>
          {showNext && next && <p className="truncate text-meta text-muted">Next: {next.label}</p>}
        </div>
        <ProgressBar value={index + 1} max={total} tone="orange" className="mt-2" />
        {step && (
          <div className="mt-2">
            <p className="text-base font-bold text-navy">{step.label}</p>
            {step.description && <p className="text-meta text-muted">{step.description}</p>}
          </div>
        )}
      </div>
      <Stepper steps={steps} current={current} className="hidden lg:flex" />
    </div>
  );
}
