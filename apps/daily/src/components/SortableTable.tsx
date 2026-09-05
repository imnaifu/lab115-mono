"use client";

import { useState } from "react";

/**
 * A table you can reorder by clicking a column head.
 *
 * ITS OWN FILE, AND THAT IS THE `"use client"` DIRECTIVE'S FAULT — the same
 * reason PageShell was split out of Shell.tsx, and the note there is the warning
 * not to merge this back. Sorting is state, state means a client component, and
 * `Table` lives in AdminShell.tsx beside `Panel`, `StatTile` and `KpiRow`, which
 * every server component on `/admin` imports. Marking that file `"use client"`
 * would push the whole page's chrome into the browser bundle to make one table
 * clickable.
 *
 * `Table` AND `Row` STAY WHERE THEY ARE and are still what the other tables use.
 * This is not a replacement for them: a table nobody would sort — 人工改分 is
 * five rows in the only order that matters, newest first — should not ship a
 * sort implementation to the browser to say so.
 *
 * NO FUNCTION PROPS CROSS THE BOUNDARY, the rule AdminChart.tsx states and
 * follows: `AdminOverview` is a server component, so the comparator lives here
 * and every prop is plain data.
 */

export interface SortColumn {
  /** Names this column in `SortableRow`'s two maps. */
  key: string;
  label: string;
  /**
   * Right-aligned, tabular, and sorted BIGGEST FIRST on the first click.
   *
   * Which way a first click should sort is a property of the data, not a
   * preference: nobody opens a column of counts to find the smallest, and nobody
   * opens a column of names to start at Z.
   */
  numeric?: boolean;
}

export interface SortableRow {
  /** React key — a stable id, not the index. */
  id: string;
  /**
   * THE VALUE EACH COLUMN SORTS BY, which is emphatically not the value it
   * shows.
   *
   * `发布率` displays `42%` and sorts on `0.42`; `均分` displays one decimal and
   * sorts on the full float. Sorting the rendered strings would order 100% before
   * 42% before 9% — string order on digits — and would tie every source whose
   * mean agrees to one decimal, in whatever order the array happened to be in.
   * Keeping the two apart is the entire reason this component takes data rather
   * than cells.
   */
  sort: Record<string, string | number>;
  /** What each column shows, already formatted. */
  text: Record<string, string>;
  /** A muted note after the FIRST column's text — 白名单, on this table. */
  note?: string;
}

type Direction = "asc" | "desc";

export function SortableTable({
  columns,
  rows,
}: {
  columns: SortColumn[];
  rows: SortableRow[];
}) {
  /**
   * `null` MEANS "AS GIVEN", and it is the initial state on purpose.
   *
   * The server already hands these rows in a considered order — `sourceRows`
   * sorts by volume — and a client component that immediately re-sorts on mount
   * would throw that away and, worse, would render something different from the
   * HTML that arrived. Nothing moves until the reader asks it to.
   */
  const [by, setBy] = useState<{ key: string; direction: Direction } | null>(
    null,
  );

  const ordered = by ? sortRows(rows, by.key, by.direction) : rows;

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-page-deep text-left">
            {columns.map((column, at) => {
              const active = by?.key === column.key;
              return (
                <th
                  /* `aria-sort` is the part a screen reader reads; the arrow is
                     the part everyone else does. Both, or the control only works
                     for one of them. */
                  aria-sort={
                    active
                      ? by.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`px-3 py-2 text-xs font-bold whitespace-nowrap ${
                    // The first column is the name; the rest are numbers, and
                    // numbers read right-aligned against the row below them.
                    at === 0 ? "" : "text-right"
                  }`}
                  key={column.key}
                  scope="col"
                >
                  {/* A REAL `<button>`, not a `<th onClick>`: this is a control,
                      so it has to be reachable by keyboard and announced as one.
                      `w-full` puts the hit area across the whole cell rather than
                      on the four characters of the label. */}
                  <button
                    className={`flex w-full cursor-pointer items-center gap-1 ${
                      at === 0 ? "" : "justify-end"
                    } ${active ? "text-ink" : "text-ink-soft"}`}
                    onClick={() =>
                      setBy((current) =>
                        current?.key === column.key
                          ? {
                              key: column.key,
                              direction:
                                current.direction === "asc" ? "desc" : "asc",
                            }
                          : {
                              key: column.key,
                              direction: column.numeric ? "desc" : "asc",
                            },
                      )
                    }
                    type="button"
                  >
                    {column.label}
                    {/* The inactive arrow is drawn and faded rather than hidden,
                        so the head does not change width when it becomes the
                        sorted one — a table whose columns jump on every click is
                        harder to use than one that never sorted. */}
                    <span
                      aria-hidden
                      className={active ? "text-ink" : "text-ink-soft opacity-30"}
                    >
                      {active && by.direction === "asc" ? "▲" : "▼"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr className="border-b border-line last:border-0" key={row.id}>
              {columns.map((column, at) => (
                <td
                  className={`px-3 py-2 whitespace-nowrap ${
                    at === 0
                      ? "font-bold text-ink"
                      : "text-right tabular-nums text-ink-mid"
                  }`}
                  key={column.key}
                >
                  {row.text[column.key]}
                  {at === 0 && row.note ? (
                    <span className="ml-1.5 text-xs font-medium text-ink-soft">
                      {row.note}
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The rows in one column's order.
 *
 * A COPY, because `Array.prototype.sort` mutates: sorting in place would reorder
 * the `rows` prop itself, and the "as given" order this component starts in — see
 * `by` above — would be gone after the first click, unrecoverable.
 *
 * Strings compare with `localeCompare` so 源 names sort the way a reader expects
 * rather than by code point; numbers compare numerically. A column whose values
 * are mixed falls back to comparing them as text, which is arbitrary but stable
 * and cannot throw.
 */
function sortRows(
  rows: SortableRow[],
  key: string,
  direction: Direction,
): SortableRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a.sort[key];
    const right = b.sort[key];
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * sign;
    }
    return String(left).localeCompare(String(right)) * sign;
  });
}
