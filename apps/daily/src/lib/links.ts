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

/** The share path for an article, e.g. `/d/2026-08-14/ff36a72e`. */
export function articlePath(date: string, id: string): string {
  return `/d/${date}/${id.slice(0, SHARE_ID_CHARS)}`;
}
