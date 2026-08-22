import { posterParts, renderPoster } from "@/lib/poster";
import { prunePosters, writePoster } from "@/lib/poster-store";
import { LANGS, type Lang } from "@/lib/lang";
import { summaryFor } from "@/lib/take";
import type { Digest } from "@/lib/types";

/**
 * Rendering every share image for a digest, at the moment the digest is written.
 *
 * WHY AT WRITE TIME. The route used to render on demand, which meant a reader who
 * opened the share sheet paid for a full Satori render per image — and a share is
 * now three to seven images, so opening the sheet was three to seven renders plus
 * a font subset fetch, on a phone, inside the window iOS still counts the tap as a
 * gesture. The images are deterministic and a digest is never edited after the day
 * it was written, so all of that work has exactly one correct time to happen: once,
 * here, not once per reader.
 *
 * The route keeps its on-demand path regardless — see the note there. This makes
 * the cache warm, it does not make it required.
 */

/**
 * Renders in flight.
 *
 * Satori is CPU-bound and this container also serves the site, so the point of a
 * limit is to leave the web process something to run on. Four is well under the
 * model-call concurrency next door in daily.ts, and for the same reason it is
 * different: that one waits on a network, this one competes for cores.
 */
const CONCURRENCY = 4;

/**
 * Every image of every article, in every language the site serves.
 *
 * BOTH LANGUAGES, which doubles the work for a digest that is Chinese-only. It is
 * still right: `/en/d/…/share.png` is a real URL that a real reader can share
 * from, and the poster it renders genuinely differs — the brand, the meta line and
 * the choice of headline are all language-dependent (see `renderPoster`). Warming
 * one language and not the other would make the other quietly slower forever,
 * which is a worse thing to own than a minute of CPU once a day.
 *
 * Never throws. Every image is independent and a failure is a cache miss, which
 * the route already handles by rendering — so a bad cover fetch or a full disk
 * costs one slow request later, not a failed digest.
 */
export async function cachePosters(
  digest: Digest,
  /**
   * Narrow the work to the images that actually changed.
   *
   * Absent means every image of every article in every language, which is what
   * the daily run wants: the digest is new, so nothing is cached yet.
   *
   * The BACKFILL wants the other thing. Adding an English take to an archived
   * digest invalidates exactly that article's English posters — the Chinese ones
   * are drawn from a Chinese take nothing touched, and the other articles are
   * untouched entirely. Re-rendering a whole day to replace four images is a
   * minute of Satori for nothing.
   *
   * It is a NARROWING, never a widening: whatever it selects still has to exist
   * in the digest.
   */
  only?: { ids?: Set<string>; langs?: Lang[] },
): Promise<void> {
  const started = Date.now();

  /**
   * The full work list, flattened before anything runs.
   *
   * Flat rather than nested loops, because the part COUNT varies per article — one
   * summary is three images and another is seven — and a nested loop would run
   * each article's parts one after another, leaving cores idle on the short ones.
   * One list means the limiter always has something to hand out.
   */
  const langs = only?.langs ?? LANGS;
  const jobs = digest.articles
    .filter((article) => !only?.ids || only.ids.has(article.id))
    .flatMap((article) =>
    langs.flatMap((lang) =>
      // The count is per LANGUAGE, not per article: the two halves paginate
      // separately, so a take that is four images in Chinese can be five in
      // English. Counting once off the Chinese left the English poster's last
      // part unwarmed — or, the other way round, asked for a part the renderer
      // says does not exist, which lands in `failed` below as a phantom error.
      Array.from({ length: posterParts(summaryFor(article, lang)) }, (_, i) => ({
        article,
        lang,
        part: i + 1,
      })),
    ),
  );

  let done = 0;
  let failed = 0;
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () =>
      (async () => {
        while (next < jobs.length) {
          const { article, lang, part } = jobs[next++];
          try {
            const bytes = await renderPoster({
              article,
              date: digest.date,
              lang,
              part,
            });
            // null is "no such part", which cannot happen here — the count came
            // from the same function the renderer paginates with. Counted as a
            // failure rather than ignored, because if it ever does happen the two
            // have disagreed and that is worth seeing in a log.
            if (bytes && (await writePoster(
              digest.date,
              article.id,
              lang,
              part,
              bytes,
            ))) {
              done += 1;
            } else {
              failed += 1;
            }
          } catch (error) {
            failed += 1;
            console.error(
              `[daily] poster ${article.id.slice(0, 8)} ${lang} part ${part} ` +
                `failed:`,
              error,
            );
          }
        }
      })(),
    ),
  );

  const dropped = await prunePosters(digest.date);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[daily] posters cached: ${done}/${jobs.length} in ${seconds}s` +
      (failed ? `, ${failed} failed` : "") +
      (dropped ? `, ${dropped} old day(s) pruned` : ""),
  );
}
