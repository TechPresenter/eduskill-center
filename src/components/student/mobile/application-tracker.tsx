import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRACKER_STEPS, trackerState, type ApplicationLike } from "@/components/student/application-status";

export interface ApplicationTrackerProps {
  application: Pick<ApplicationLike, "id" | "status" | "waitlistPosition">;
  /** Application number shown in the header. */
  applicationNo?: string;
  /** Turns the header into a link to the application detail page. */
  href?: string;
  className?: string;
}

const NODE = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-caption font-bold transition-colors duration-micro motion-reduce:transition-none";

/**
 * Four-milestone horizontal tracker (Submitted → Documents verified → Payment → Admission confirmed).
 * Server-safe and width-safe at 360px: nodes are 28px and labels sit at the 12px caption step,
 * wrapping under their own node rather than shrinking — there is no `whitespace-nowrap` here, which
 * is what keeps four columns inside a 296px card without horizontal overflow.
 */
export function ApplicationTracker({ application, applicationNo, href, className }: ApplicationTrackerProps) {
  const state = trackerState(application);
  const currentRing = state.tone === "danger" ? "border-danger bg-white text-danger" : state.tone === "warning" ? "border-warning bg-white text-warning" : "border-orange bg-white text-orange";
  const doneBar = state.tone === "danger" ? "bg-danger" : "bg-orange";

  return (
    <section className={cn("card p-4", className)} aria-label="Application progress">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-body-sm font-bold text-navy">Application progress</p>
        {applicationNo &&
          (href ? (
            // 44px tap target, pulled back with negative margin so the header row keeps its height.
            <Link href={href} className="text-caption ring-focus -my-2.5 -mr-1 inline-flex min-h-11 items-center px-1 font-mono font-semibold text-orange">
              {applicationNo}
            </Link>
          ) : (
            <span className="font-mono text-caption text-muted">{applicationNo}</span>
          ))}
      </div>

      <ol className="flex items-start">
        {TRACKER_STEPS.map((step, i) => {
          const isDone = i < state.done;
          const isCurrent = i === state.current;
          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center" aria-hidden>
                <span className={cn("h-0.5 flex-1 rounded-full", i === 0 ? "bg-transparent" : isDone || isCurrent ? doneBar : "bg-line")} />
                <span
                  className={cn(
                    NODE,
                    isDone ? "border-orange bg-orange text-white" : isCurrent ? currentRing : "border-line bg-white text-muted"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : isCurrent && state.failed ? <X className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("h-0.5 flex-1 rounded-full", i === TRACKER_STEPS.length - 1 ? "bg-transparent" : isDone ? doneBar : "bg-line")} />
              </div>
              <p
                className={cn("mt-1.5 px-0.5 text-center text-caption leading-tight", isDone || isCurrent ? "font-semibold text-navy" : "text-muted")}
                aria-current={isCurrent ? "step" : undefined}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>

      {state.hint && <p className={cn("mt-3 text-body-sm leading-5", state.failed ? "text-danger" : "text-muted")}>{state.hint}</p>}
    </section>
  );
}
