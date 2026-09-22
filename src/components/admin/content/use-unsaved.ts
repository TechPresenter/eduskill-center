"use client";

import * as React from "react";

/**
 * Warns before the tab is closed or reloaded while an editor holds unsaved changes. In-app navigation
 * is not intercepted (the App Router offers no hook for it); the editors show a SaveStatus instead.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need a returnValue to show the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
