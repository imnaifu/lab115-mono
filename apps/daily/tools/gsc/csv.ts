/**
 * Rows of objects → a CSV, with the escaping that makes it survive a spreadsheet.
 *
 * Hand-rolled rather than a dependency, for the reason gsc.ts gives about the
 * auth SDK: this is the whole of what a CSV writer does. The quoting rule is
 * RFC 4180 — a field containing a comma, a quote or a newline is wrapped in
 * quotes, and a literal quote inside it is doubled. URLs and Google's error
 * strings contain all three.
 *
 * The BOM is for Excel, which otherwise reads a UTF-8 file as the system code
 * page and turns every Chinese title into mojibake. Numbers and Sheets both
 * ignore it.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
  ];
  return `﻿${lines.join("\n")}\n`;
}
