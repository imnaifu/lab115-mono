import type { ReactNode } from "react";
import { SAMPLE_FLOOR } from "@/lib/stats";

/**
 * The chrome and the primitives `/admin` is built out of.
 *
 * IT IS NOT THE SITE'S DESIGN SYSTEM AND DOES NOT TRY TO BE. No `Masthead`, no
 * `PageShell`, no subscribe block — those are the publication's lockup, and this
 * is an instrument panel for one person. What it does share is the TOKENS
 * (`bg-paper`, `text-ink`, `border-line`, and the dark side of all of them
 * through `light-dark()` in index.css), so it is legible in either theme without
 * a single colour of its own.
 *
 * ONE LANGUAGE, CHINESE, and no `Lang` anywhere in this tree. The
 * one-language-at-a-time rule in lib/i18n is about not serving a reader the half
 * they cannot read; here the reader is known and there is exactly one of them.
 * Adding an `/en/admin` would be translating a page for nobody — so these strings
 * are literals rather than entries in `strings()`, which is also what keeps 64
 * admin labels out of the file every reader-facing string lives in.
 *
 * TABULAR NUMBERS EVERYWHERE A COLUMN OF THEM APPEARS. `tabular-nums` is the one
 * typographic decision on this page that is not decoration: a column of
 * proportional digits does not line up, and every number here is meant to be
 * compared with the one above it.
 */

/** The outer frame: a title, the nav between the two views, and the content. */
export function AdminShell({
  title,
  meta,
  nav,
  children,
}: {
  title: string;
  /** The one line under the title that says what was measured. */
  meta?: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-7">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          {meta ? (
            <p className="mt-1 text-sm tabular-nums text-ink-soft">{meta}</p>
          ) : null}
        </div>
        {nav ? <nav className="flex flex-wrap gap-2">{nav}</nav> : null}
      </header>
      {children}
    </main>
  );
}

/** A link in the header nav, or in a row of dates. */
export function AdminLink({
  href,
  children,
  current,
}: {
  href: string;
  children: ReactNode;
  /** The page you are already on — rendered as a pressed state rather than a
   *  link, so the nav says where you are without a second indicator. */
  current?: boolean;
}) {
  const shape =
    "rounded-full border border-line px-3 py-1.5 text-sm font-bold tabular-nums";
  return current ? (
    <span className={`${shape} bg-ink text-paper`}>{children}</span>
  ) : (
    <a className={`${shape} bg-paper text-ink-mid`} href={href}>
      {children}
    </a>
  );
}

/**
 * One block of the page: a heading, an optional note, and whatever it measures.
 *
 * `note` IS WHERE THE CAVEAT GOES, and every panel on this page has one. A
 * correlation of 0.87 is a number; "0.87, over 324 articles, and 0.91 was what
 * the 7→5 merge was made to fix" is a finding. The notes are the difference
 * between a dashboard and something you can act on, so the prop is not optional
 * by accident — it is passed on all but the most literal tables.
 */
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
      {note ? (
        <p className="mt-1 max-w-prose text-sm text-ink-soft">{note}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * A stat tile: the label, the number, and optionally one line of context.
 *
 * A TILE RATHER THAN A ONE-BAR CHART. Four headline numbers is a KPI row, and
 * drawing each of them as a bar with nothing to compare against is the most
 * common way a dashboard wastes its top third — the number IS the chart.
 *
 * PROPORTIONAL FIGURES ON THE VALUE, deliberately not `tabular-nums`. Equal-width
 * digits are for columns that must align vertically; at display size they make a
 * number like `324` look loose and gappy. The tables below are where tabular
 * figures belong, and they have them.
 */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-paper px-4 py-3">
      <div className="text-xs font-bold text-ink-soft">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tracking-tight text-ink">
        {value}
      </div>
      {note ? (
        <div className="mt-0.5 text-xs font-medium text-ink-soft">{note}</div>
      ) : null}
    </div>
  );
}

/** The row of them. Wraps to two columns on a phone rather than scrolling. */
export function KpiRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * `n = …`, with a mark when the sample is thin.
 *
 * SHOWN BESIDE EVERY STATISTIC, which is the rule stated at the top of lib/stats:
 * a page that prints three decimals without saying what they were computed over
 * invites tuning a rubric against a fortnight of one blog. The warning triangle
 * is deliberately not a hidden number — see `SAMPLE_FLOOR` for why nothing here
 * is withheld until it is "significant".
 */
export function SampleSize({ n }: { n: number }) {
  const thin = n < SAMPLE_FLOOR;
  return (
    <span
      className={`text-xs font-bold tabular-nums ${
        thin ? "text-ink" : "text-ink-soft"
      }`}
      title={thin ? `少于 ${SAMPLE_FLOOR} 条，当参考而不是结论` : undefined}
    >
      n={n}
      {thin ? " ⚠" : ""}
    </span>
  );
}

/**
 * A horizontal bar, as a fraction of the widest value in its group.
 *
 * RELATIVE TO THE GROUP'S MAX rather than to a fixed scale, because every bar
 * chart on this page is a shape question — where does the mass sit, is the top of
 * the range used at all — and a bar scaled to an absolute maximum flattens the
 * differences that answer it. The number is always printed beside it, so the bar
 * never has to carry the value on its own.
 */
export function Bar({
  value,
  max,
  tone = "ink",
}: {
  value: number;
  max: number;
  tone?: "ink" | "soft";
}) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-page-deep">
      <span
        className={`block h-full rounded-full ${
          tone === "ink" ? "bg-ink" : "bg-ink-soft"
        }`}
        // A width has to be a computed number, so it cannot be a utility class.
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

/**
 * A plain table, scrollable sideways on a phone.
 *
 * THE `overflow-x-auto` WRAPPER IS LOAD-BEARING and is why this is a component
 * rather than a bare `<table>`: the per-source table is seven columns, and
 * without a scroll container of its own it makes the whole document scroll
 * horizontally on a narrow screen.
 */
export function Table({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-page-deep text-left">
            {head.map((cell, at) => (
              <th
                className={`px-3 py-2 text-xs font-bold whitespace-nowrap text-ink-soft ${
                  // Everything but the first column is a number, and numbers
                  // read right-aligned against the row below them.
                  at === 0 ? "" : "text-right"
                }`}
                key={cell}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** One row of `Table`. `cells` after the first are right-aligned numbers. */
export function Row({ cells }: { cells: ReactNode[] }) {
  return (
    <tr className="border-b border-line last:border-0">
      {cells.map((cell, at) => (
        <td
          className={`px-3 py-2 whitespace-nowrap ${
            at === 0
              ? "font-bold text-ink"
              : "text-right tabular-nums text-ink-mid"
          }`}
          key={at}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}

/** Two decimals, or a dash where there is no number to show — an empty cell and
 *  a zero are different facts and a table must not spell them the same. */
export function num(value: number | null | undefined, places = 2): string {
  return value === null || value === undefined || Number.isNaN(value)
    ? "—"
    : value.toFixed(places);
}

/** A percentage from a 0-1 fraction. */
export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
