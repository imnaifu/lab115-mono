/**
 * The site's own address, in ONE place.
 *
 * It was written out three times — in the root layout's `metadataBase`, in the
 * sitemap, and again inside `public/robots.txt` — and the third copy was the one
 * that mattered: a static text file cannot read a constant, so a rename would
 * have left robots.txt pointing a crawler at a sitemap on the old domain with
 * nothing to catch it. That file is now generated from this value; see
 * app/robots.ts, and the same arrangement in apps/daily.
 */
export const SITE = "https://lab115.com";
