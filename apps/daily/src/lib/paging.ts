/**
 * How the archive is addressed, and the one number the front page still uses.
 *
 * IT USED TO HOLD TWO NUMBERS with a paragraph about three files having to agree
 * on them. `ARCHIVE_PAGE_SIZE` is gone with pagination (see below) and
 * `FRONT_DAYS` has one caller left, so the agreement this file was protecting is
 * mostly a question nobody asks any more. What replaced it is a shape rather
 * than a size: a month.
 */

/**
 * Days the front page's own reads are bounded by.
 *
 * ONE CALLER LEFT — `/llms.txt`, which lists the recent editions. The front page
 * itself reads exactly one digest now (see `FRONT_POSTS` there), so this no
 * longer bounds what it opens; it bounds what a machine-readable index calls
 * "recent".
 */
export const FRONT_DAYS = 7;

/**
 * THE ARCHIVE IS BROWSED BY MONTH NOW, NOT BY PAGE.
 *
 * `ARCHIVE_PAGE_SIZE = 30`, `archivePages`, `archiveSlice` and the numbered
 * `/archive/<n>` URLs are all gone. What they gave a reader was position — "page
 * 2 of 4" — which is a fact about the list's length rather than about the
 * archive, and it changes meaning every time a digest lands: today's page 2 is
 * not the page 2 somebody bookmarked last week. A month is the unit this site
 * actually publishes into, it never renumbers, and it is the thing somebody
 * looking for an old piece already half-remembers.
 *
 * THE NUMBERED URLS 308 TO `/archive` rather than 404ing — see the `[month]`
 * route. There were two of them (`/archive` and `/archive/2` against 33 days)
 * and they are in the sitemap and the index. A 404 tells a crawler the page is
 * gone and the signals die with it; a permanent redirect says where they went.
 * That is the same call, for the same reason, as the `/zh/…` and `/d/…`
 * redirects in proxy.ts and app/[lang]/d/.
 */

/** `2026-09` from `2026-09-21` — the key a month page is addressed by. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/**
 * One month's page: `/archive` for the newest, `/archive/2026-08` for the rest.
 *
 * THE NEWEST MONTH IS THE BARE `/archive`, and it is the same rule page 1 had:
 * one page, one URL. What it costs that pagination did not is that the bare URL
 * CHANGES MEANING on the first of every month — `/archive` was September and is
 * October now. That is correct for a front-of-archive (it is the "latest" view,
 * like `/` is), and it is why every month ALSO has its own dated URL that never
 * moves: the sitemap lists those, not this one. See the sitemap's archive loop.
 */
export function archivePath(month?: string): string {
  return month ? `/archive/${month}` : "/archive";
}

/** Every month the archive holds, newest first, with how many days in each. */
export function archiveMonths(
  dates: string[],
): { month: string; days: number }[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = monthOf(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // `dates` is newest-first, so insertion order already is.
  return [...counts].map(([month, days]) => ({ month, days }));
}

/** The dates in one month, newest first — `dates` is already in that order. */
export function archiveMonthSlice(dates: string[], month: string): string[] {
  return dates.filter((date) => monthOf(date) === month);
}

/** Whether a segment is a month key this site could have published in. Checked
 *  before anything touches the filesystem, the same way `readDigest` checks a
 *  date — a crafted segment must not reach a directory walk. */
export function isMonthKey(segment: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(segment);
}
