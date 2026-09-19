import * as React from "react";

/** Wraps an action so a missing permission renders it disabled with a tooltip instead of hiding it. */
export function Gate({ allowed, reason = "You do not have permission for this action", children }: { allowed: boolean; reason?: string; children: React.ReactElement<{ disabled?: boolean; title?: string }> }) {
  if (allowed) return children;
  return (
    <span title={reason} className="inline-flex" aria-disabled="true">
      {React.cloneElement(children, { disabled: true, title: reason })}
    </span>
  );
}
