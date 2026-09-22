/**
 * The admin building blocks. This is the canonical home for the helpers the audit found duplicated:
 * the filter bar, the URL helpers, the export control and the tab strip all live here now, and the
 * older module paths (`@/components/admin/pickers/*`) re-export from here so no page had to move.
 */
export * from "./url";
export * from "./use-url-params";
export * from "./use-api-form";
export * from "./filter-bar";
export * from "./list-page";
export * from "./export-button";
export * from "./confirm-action";
export * from "./record-actions";
export * from "./json-diff";
export * from "./tab-links";
export * from "./image-field";
export * from "./icon-picker";
export * from "./permission-matrix";
export * from "./copy-button";
