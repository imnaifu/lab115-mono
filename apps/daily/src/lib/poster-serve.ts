import { renderPoster } from "./poster";
import { readPoster, writePoster } from "./poster-store";
import { readArticle } from "./store";
import type { Lang } from "./lang";

/**
 * Getting a poster: from the cache if the job already made it, rendered and kept
 * if not.
 *
 * SPLIT OUT OF THE ROUTE so the route is only HTTP. A cache miss is ordinary — a
 * fresh container, a digest older than the cache's retention, a day the job has
 * not reached yet — and the response to one is to render, not to fail, which is
 * enough policy to be worth naming.
 */

/** One image, or null if there is no such article or no such part. */
export async function posterBytes(
  date: string,
  id: string,
  lang: Lang,
  part: number,
): Promise<Buffer | null> {
  const cached = await readPoster(date, id, lang, part);
  if (cached) return cached;

  const found = await readArticle(date, id);
  if (!found) return null;

  const bytes = await renderPoster({ article: found.article, date, lang, part });
  if (!bytes) return null;

  // Not awaited: the reader is waiting on the image, not on the cache write, and
  // a failed write is already swallowed inside.
  void writePoster(date, id, lang, part, bytes);
  return bytes;
}
