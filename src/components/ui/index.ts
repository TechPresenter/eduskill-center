/**
 * Design-system barrel: `import { Button, Field, BottomSheet } from "@/components/ui"`.
 *
 * No "use client" here: each module keeps its own boundary, so server pages may still pass functions
 * (e.g. `Pagination hrefFor`) to the server-safe primitives while the client ones (BottomSheet, Toaster,
 * TableWrap, Tabs…) stay client components.
 */

// Buttons & inputs
export * from "./button";
export * from "./input";
export * from "./select";
export * from "./date-input";
export * from "./form";
export * from "./file-upload";

// Data display
export * from "./badge";
export * from "./card";
export * from "./table";
export * from "./responsive-table";
export * from "./stats";
export * from "./misc";
export * from "./highlight";
export * from "./icon";

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
