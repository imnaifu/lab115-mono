/**
 * URL shapes, kept apart from `store.ts` because these are needed in the
 * BROWSER and store.ts imports `node:fs`. A client component pulling in the
 * filesystem module is a build error, and the only thing it wanted was a string
 * template.
 */

/**
 * How much of an article id a share link carries.
 *
 * The id is a 40-character sha1, which is unreadable in a URL and worse printed
 * across the bottom of a share poster. Eight hex characters is 32 bits against
 * the ~20 articles in one day — the collision probability inside a single
 * digest is around 2e-8, and a collision would show the wrong article rather
 * than crash, so the shorter link is worth it.
 */
export const SHARE_ID_CHARS = 8;

/**
 * The short id: the last segment of an article's URL, and the DOM id its card
 * carries so the share dialog can scope a text selection to that one article.
 *
 * One identifier for both, so a reader comparing a shared link with a poster
 * filename sees the same eight characters. Note it can begin with a digit — legal
 * in HTML and fine for `getElementById`, but it must never be interpolated into a
 * raw CSS selector without escaping. Nothing does.
 */
export function articleAnchor(id: string): string {
  return id.slice(0, SHARE_ID_CHARS);
}

/**
 * The single-article page, e.g. `/d/2026-08-14/ff36a72e`.
 *
 * What gets shared, and where the poster is rendered from. There was briefly an
 * `articleHash` beside this returning `/d/<date>#<anchor>` — the day's list with a
 * fragment — and it is worth recording why it went: a fragment never reaches the
 * server, so a crawler fetching that URL cannot know which article was meant and
 * the link preview loses the poster. A shared link that shows nothing is a worse
 * trade than one that opens a single-article page.
 */
export function articlePath(date: string, id: string): string {
  return `/d/${date}/${articleAnchor(id)}`;
}
