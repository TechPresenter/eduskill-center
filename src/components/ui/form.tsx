import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label?: React.ReactNode;
  /** Id of the control the label points at. When omitted and `children` is a single control, Field generates one. */
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  /** Validation error rendered directly under the control (red, with icon, `role="alert"`). */
  error?: React.ReactNode;
  /** Positive confirmation rendered under the control (green, with icon). Shown only when there is no error. */
  success?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Set to `false` to stop Field from injecting `id` / `aria-describedby` / `aria-invalid` into a single child control. */
  autoWire?: boolean;
}

type ControlElement = React.ReactElement<Record<string, unknown>>;

/** True for a lone child that can carry id/aria attributes: any component, or a native form control. */
function asControl(children: React.ReactNode): ControlElement | null {
  if (!React.isValidElement<Record<string, unknown>>(children)) return null;
  if (children.type === React.Fragment) return null;
  if (typeof children.type === "string" && !["input", "select", "textarea"].includes(children.type)) return null;
  return children;
}

/**
 * Label + control + hint / error / success wrapper.
 *
 * Accessibility is wired automatically: with a single control child the label gets an `htmlFor`
 * (generated when the child has no `id`), the control receives `aria-describedby` for the message
 * shown beneath it and `aria-invalid` while `error` is set. Pass `htmlFor` explicitly for composite controls.
 */
export function Field({ label, htmlFor, required, hint, error, success, className, children, autoWire = true }: FieldProps) {
  const reactId = React.useId();
  const control = autoWire ? asControl(children) : null;
  const childId = control && typeof control.props.id === "string" ? control.props.id : undefined;
  const controlId = htmlFor ?? childId ?? (control ? `${reactId}f` : undefined);

  const message = error ? "error" : success ? "success" : hint ? "hint" : null;
  const messageId = message ? `${controlId ?? reactId}-${message}` : undefined;

  let body: React.ReactNode = children;
  if (control) {
    const extra: Record<string, unknown> = {};
    if (!childId && !htmlFor && controlId) extra.id = controlId;
    if (messageId) {
      const existing = typeof control.props["aria-describedby"] === "string" ? (control.props["aria-describedby"] as string) : undefined;
      extra["aria-describedby"] = existing ? `${existing} ${messageId}` : messageId;
    }
    if (error && control.props["aria-invalid"] === undefined) extra["aria-invalid"] = true;
    if (Object.keys(extra).length) body = React.cloneElement(control, extra);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="block text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {body}
      {message === "error" ? (
        <p id={messageId} className="flex items-start gap-1.5 text-[13px] font-medium text-danger" role="alert">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : message === "success" ? (
        <p id={messageId} className="flex items-start gap-1.5 text-[13px] font-medium text-green-700" role="status">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden />
          <span>{success}</span>
        </p>
      ) : message === "hint" ? (
        <p id={messageId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Anchor id (e.g. for "jump to section" links or scrolling to the first invalid section). */
  id?: string;
}

export function FormSection({ title, description, children, className, id }: FormSectionProps) {
  return (
    <section id={id} className={cn("space-y-5 scroll-mt-20", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="border-b border-line pb-3">
        <h3 id={id ? `${id}-title` : undefined} className="text-base font-bold text-navy">
          {title}
        </h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function FormGrid({ children, className, cols = 2 }: { children: React.ReactNode; className?: string; cols?: 1 | 2 | 3 | 4 }) {
  const c = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[cols];
  return <div className={cn("grid grid-cols-1 gap-4", c, className)}>{children}</div>;
}

/** Static action row (stacked on phones, right-aligned on sm+). Wizards and long forms use StickyActionBar instead. */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end", className)}>{children}</div>;
}
