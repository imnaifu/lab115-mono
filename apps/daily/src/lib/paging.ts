/**
 * How the run of days is split between the front page and the archive.
 *
 * BOTH NUMBERS LIVE HERE because three places have to agree about them: the front
 * page slices by the first, the archive paginates by the second, and the sitemap
 * has to know how many archive pages exist and whether the archive is worth listing
 * at all. Three independent copies is three chances to disagree, and a disagreement
 * here is a sitemap pointing at a page that does not exist.
 */

/** Days on the front page. A week, so it answers "what did I miss?" and stops. */
export const FRONT_DAYS = 7;

/**
 * Days per archive page. A month, deliberately larger than `FRONT_DAYS`.
 *
 * The gap between the two is what keeps `/` and `/archive` from reading as the same
 * page: seven rows against thirty is a different document, not a shorter one. If
 * these were equal, the archive's first page WOULD be the front page — which is the
 * duplicate-canonical problem this site already had once, rebuilt one route over.
 */
export const ARCHIVE_PAGE_SIZE = 30;

/**
 * Whether the archive has anything the front page is not already showing.
 *
 * The front page links to it only when this is true, and the sitemap lists it only
 * when this is true — same condition, stated once. Below the threshold the archive
 * would be the front page's list a second time, so nothing points at it and nothing
 * asks Google to index it. It comes into being on the day the eighth digest lands.
 */
export function hasArchive(total: number): boolean {
  return total > FRONT_DAYS;
}

/** How many pages the archive runs to. Zero when there is no archive yet. */
export function archivePages(total: number): number {
  if (!hasArchive(total)) return 0;
  return Math.ceil(total / ARCHIVE_PAGE_SIZE);
}

/** The dates on one archive page. `page` is 1-based. */
export function archiveSlice(dates: string[], page: number): string[] {
  const from = (page - 1) * ARCHIVE_PAGE_SIZE;
  return dates.slice(from, from + ARCHIVE_PAGE_SIZE);
}

/**
 * The path of one archive page. Page 1 is the bare `/archive`, never `/archive/1`.
 *
 * Two URLs for the first page is the smallest possible version of the duplicate
 * this whole layout is arranged to avoid, so `/archive/1` is not a URL this site
 * emits — and the route redirects it, in case someone types it.
 */
export function archivePath(page: number): string {
  return page <= 1 ? "/archive" : `/archive/${page}`;
}
