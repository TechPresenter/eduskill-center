/**
 * Moved. There is one export control now: `@/components/admin/shared/export-button`.
 * This module re-exports it so the pages importing from here keep working — the only visible change
 * is that a CSV-only endpoint no longer offers XLSX and PDF downloads it cannot produce.
 */
export { ExportButton, type ExportButtonProps, type ExportFormat } from "@/components/admin/shared/export-button";
