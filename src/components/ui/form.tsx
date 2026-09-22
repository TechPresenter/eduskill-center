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

/** One message slot for the whole product: same size (14px), same 6px gap, same icon, same position. */
function FieldMessage({
  id,
  tone,
  children,
}: {
  id?: string;
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const error = tone === "error";
  return (
    <p
      id={id}
      role={error ? "alert" : "status"}
      className={cn("flex items-start gap-1.5 text-sm font-medium", error ? "text-danger" : "text-success-dark")}
    >
      {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

/**
 * Label + control + hint / error / success wrapper — the single field anatomy for public forms,
 * portals and admin alike.
 *
 * Accessibility is wired automatically: with a single control child the label gets an `htmlFor`
 * (generated when the child has no `id`), and the control receives an `aria-describedby` that points at
 * *every* message under it — the hint AND the error — plus `aria-invalid` while `error` is set.
 * The hint stays visible when an error appears, because "what we expect" and "what went wrong" are
 * different questions. Pass `htmlFor` explicitly for composite controls.
 */
export function Field({ label, htmlFor, required, hint, error, success, className, children, autoWire = true }: FieldProps) {
  const reactId = React.useId();
  const control = autoWire ? asControl(children) : null;
  const childId = control && typeof control.props.id === "string" ? control.props.id : undefined;
  const controlId = htmlFor ?? childId ?? (control ? `${reactId}f` : undefined);

  const base = controlId ?? reactId;
  const hintId = hint ? `${base}-hint` : undefined;
  const status = error ? "error" : success ? "success" : null;
  const statusId = status ? `${base}-${status}` : undefined;
  const describedBy = [hintId, statusId].filter(Boolean).join(" ") || undefined;

  let body: React.ReactNode = children;
  if (control) {
    const extra: Record<string, unknown> = {};
    if (!childId && !htmlFor && controlId) extra.id = controlId;
    if (describedBy) {
      const existing = typeof control.props["aria-describedby"] === "string" ? (control.props["aria-describedby"] as string) : undefined;
      extra["aria-describedby"] = existing ? `${existing} ${describedBy}` : describedBy;
    }
    if (error && control.props["aria-invalid"] === undefined) extra["aria-invalid"] = true;
    if (Object.keys(extra).length) body = React.cloneElement(control, extra);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="block text-sm font-semibold text-ink">
          {label}
          {required && (
            <>
              <span className="ml-0.5 text-danger" aria-hidden>
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </label>
      )}
      {body}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {status === "error" ? (
        <FieldMessage id={statusId} tone="error">
          {error}
        </FieldMessage>
      ) : status === "success" ? (
        <FieldMessage id={statusId} tone="success">
          {success}
        </FieldMessage>
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
    <section id={id} className={cn("space-y-4 scroll-mt-20", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="border-b border-line pb-3">
        <h3 id={id ? `${id}-title` : undefined} className="text-h4 text-navy">
          {title}
        </h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
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
  return <div className={cn("flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end", className)}>{children}</div>;
}
