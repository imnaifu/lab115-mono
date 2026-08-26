import { renderPoster } from "./poster";
import { readArticle } from "./store";
import type { Lang } from "./lang";

/**
 * Getting a poster: find the article, draw it.
 *
 * THERE IS NO SERVER-SIDE CACHE ANY MORE, and there was one — a directory of PNGs
 * on the mounted volume, keyed date + article + language + part, with a 30-day
 * retention and an explicit invalidation the English backfill had to call.
 *
 * IT WAS DELETED BECAUSE OF WHAT IT DID TO A DESIGN CHANGE. An entry never
 * expired on its own, so the day the poster's lockup moved, every image already
 * on disk went on shipping the old one — for up to thirty days, to exactly the
 * readers who had shared the article, and with nothing in the codebase that could
 * be run to fix it. The cache had no way to say "the renderer changed"; it only
 * knew about dates. Every other change here — the wordmark, the type scale, the
 * pagination — would have had the same problem the same way.
 *
 * THE CACHE THAT IS LEFT IS THE HTTP ONE, and it is the right one: the route sets
 * `public, max-age=3600`, so a share sheet's two fetches of the same part cost one
 * render, a crawler storm costs one, and a design change is live within the hour
 * instead of within the month. What it costs is a render per part per hour per
 * article that anyone actually shares — around a second for the cover part and
 * ~0.1s for a page of prose, against the sheet's four-second budget. See
 * PREPARE_WAIT_MS in ShareButton, and the `png` headers in the share route.
 *
 * The fonts are still cached in process — see `loadSubset` in lib/poster-assets —
 * so what a render pays for is Satori, not a trip to Google.
 *
 * STILL SPLIT OUT OF THE ROUTE, so the route stays HTTP and nothing else. What
 * lives here is the one policy decision left: a request that names no article is
 * a 404 rather than a blank canvas.
 */

/** One image, or null if there is no such article or no such part. */
export async function posterBytes(
  date: string,
  id: string,
  lang: Lang,
  part: number,
): Promise<Buffer | null> {
  const found = await readArticle(date, id);
  if (!found) return null;

  return renderPoster({ article: found.article, date, lang, part });
}
