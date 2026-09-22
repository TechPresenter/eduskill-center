"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StepperStep } from "@/components/ui/misc";
import { WizardProgress } from "@/components/ui/wizard-progress";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

export interface WizardShellProps {
  steps: StepperStep[];
  /** Zero-based index of the current step. */
  current: number;
  /** Optional heading above the progress (the mobile app bar usually already shows the page title). */
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Back button; omitted on the first step when undefined. */
  onBack?: () => void;
  backLabel?: React.ReactNode;
  /** Next / primary action. Omit together with `nextType="submit"` to let the form handle it. */
  onNext?: () => void;
  nextLabel?: React.ReactNode;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** "submit" renders Next as a submit button for the form named by `form` (id). Default "button". */
  nextType?: "button" | "submit";
  /** Id of the form Next submits (with `nextType="submit"`). */
  form?: string;
  /** Text button "Save & continue later" (phones: above the buttons; desktop: left of them). */
  onSaveLater?: () => void;
  saveLaterLabel?: React.ReactNode;
  /** Small note beside the Save-later button (e.g. autosave status). */
  footerNote?: React.ReactNode;
  /** Hide the footer (success step). */
  hideFooter?: boolean;
  className?: string;
  bodyClassName?: string;
  /** Classes for the sticky progress header (defaults to a translucent `bg-surface`). */
  headerClassName?: string;
}

/**
 * Multi-step form frame: sticky `WizardProgress` under the app bar, the step body, and a
 * `StickyActionBar` footer (Back outline w-28 · Next flex-1 · optional "Save & continue later").
 * Below lg the footer is fixed and hides the bottom nav; at lg+ it renders inline like FormActions.
 */
export function WizardShell({
  steps,
  current,
  title,
  children,
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  nextLoading,
  nextType = "button",
  form,
  onSaveLater,
  saveLaterLabel = "Save & continue later",
  footerNote,
  hideFooter,
  className,
  bodyClassName,
  headerClassName,
}: WizardShellProps) {
  const showNext = Boolean(onNext) || nextType === "submit";
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div
        className={cn(
          // No backdrop-blur: a filtered ancestor becomes the containing block for every position:fixed
          // descendant (that is what clamped the mobile menu and hid the Fab), and blur on a surface that
          // scrolls costs frames on the cheap Android phones most of our students use. Opaque instead.
          "sticky top-[calc(var(--header-h)_+_env(safe-area-inset-top,0px))] z-sticky -mx-4 border-b border-line bg-surface px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0",
          headerClassName
        )}
      >
        {title && <h2 className="mb-2 text-h3 text-navy">{title}</h2>}
        <WizardProgress steps={steps} current={current} />
      </div>

      <div className={cn("min-w-0", bodyClassName)}>{children}</div>

      {!hideFooter && (
        <StickyActionBar hideBottomNav>
          <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            {(onSaveLater || footerNote) && (
              <div className="flex items-center justify-center gap-3 lg:mr-auto lg:justify-start">
                {footerNote && <span className="text-body-sm text-muted">{footerNote}</span>}
                {onSaveLater && (
                  <button
                    type="button"
                    onClick={onSaveLater}
                    className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-navy underline-offset-4 tap-highlight-none ring-focus hover:underline focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    {saveLaterLabel}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-3">
              {onBack && (
                <Button type="button" variant="outline" size="md" onClick={onBack} leftIcon={<ChevronLeft className="h-4 w-4" />} className="w-28 shrink-0 lg:w-auto">
                  {backLabel}
                </Button>
              )}
              {showNext && (
                <Button
                  type={nextType}
                  form={nextType === "submit" ? form : undefined}
                  onClick={nextType === "submit" ? undefined : onNext}
                  disabled={nextDisabled}
                  loading={nextLoading}
                  size="md"
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                  className="flex-1 lg:flex-none"
                >
                  {nextLabel}
                </Button>
              )}
            </div>
          </div>
        </StickyActionBar>
      )}
    </div>
  );
}
