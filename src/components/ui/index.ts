/**
 * Design-system barrel: `import { Button, Field, BottomSheet } from "@/components/ui"`.
 *
 * Every module of the kit is listed here — if a component is not re-exported below it is either an
 * internal (`carousel-hooks`, `table-wrap`, both surfaced through their public module) or it does not
 * exist yet. Keep this list complete: a half-barrel is how two import styles for one component start.
 *
 * No "use client" here: each module keeps its own boundary, so server pages may still pass functions
 * (e.g. `Pagination hrefFor`) to the server-safe primitives while the client ones (BottomSheet, Toaster,
 * TableWrap, Tabs, Carousel…) stay client components.
 */

// Controls: buttons, fields and everything the user types into
export * from "./button";
export * from "./input";
export * from "./select";
export * from "./date-input";
export * from "./form";
export * from "./file-upload";

// Data display
export * from "./badge";
export * from "./card";
export * from "./table"; // also re-exports TableWrap from ./table-wrap
export * from "./responsive-table";
export * from "./stats";
export * from "./misc";
export * from "./highlight";
export * from "./icon";
export * from "./carousel";

// Feedback & navigation
export * from "./feedback";
export * from "./tabs";
export * from "./toast";

// Overlays
export * from "./modal";
export * from "./dropdown";
export * from "./bottom-sheet";
export * from "./action-sheet";
export * from "./responsive-sheet";

// Mobile app layer
export * from "./fab";
export * from "./sticky-action-bar";
export * from "./wizard-progress";
export * from "./wizard-shell";
export * from "./swipe-row";
