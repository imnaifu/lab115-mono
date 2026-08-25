import fs from "node:fs/promises";
import path from "node:path";
import { DATA_PATH } from "./paths";
import { articleAnchor } from "./links";
import type { Lang } from "./lang";

/**
 * Where rendered share posters live on disk.
 *
 * OUTSIDE THE GIT CLONE, deliberately. The obvious place is next to the JSON in
 * `repo/daily/<yyyy>/<mm>/`, and that would be a mistake: a day is ~20 articles
 * times ~3.5 images times ~150KB, so committing them is ~10MB a day and several
 * gigabytes a year in a repo whose entire text history is a few megabytes. The
 * digests are the record; the posters are derived, and anything derived from a
 * record belongs in a cache.
 *
 * That makes this a CACHE and not a store, with everything that follows: a miss
 * is ordinary — a fresh container, a pruned old date, a digest written before
 * this existed — and the only correct response to one is to render. See the route
 * in app/share/[lang]/[date]/[id]/[part].
 *
 * The key is date + article + language + part. Language is in there because the
 * poster is written in the language of the page that linked to it: the brand, the
 * meta line and the choice of headline all differ, so /zh and /en are two
 * different images of the same article.
 */
const POSTER_DIR = path.join(DATA_PATH, "posters");

/**
 * How many days of posters to keep.
 *
 * A cap rather than forever, because this is a mounted volume in a container and
 * nothing else would ever delete from it. 30 days covers how far back the front
 * page's list is usually opened; older dates still work, they just render on demand the first time
 * anyone asks, which for a two-month-old digest is approximately never.
 */
const KEEP_DAYS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One poster's path, or null if the inputs could not name a safe one.
 *
 * The date is pattern-checked and the id is reduced to its eight-character anchor
 * before either reaches a path: both arrive from a URL, and `readArticle` accepts
 * that short form, so `..` in either would otherwise be a traversal out of the
 * cache directory.
 */
function posterPath(
  date: string,
  id: string,
  lang: Lang,
  part: number,
): string | null {
  if (!DATE_RE.test(date)) return null;
  if (!Number.isInteger(part) || part < 1) return null;
  const anchor = articleAnchor(id);
  if (!/^[0-9a-f]{1,40}$/.test(anchor)) return null;
  return path.join(POSTER_DIR, date, `${anchor}-${lang}-${part}.png`);
}

/** The cached bytes, or null for a miss. A miss is never an error here. */
export async function readPoster(
  date: string,
  id: string,
  lang: Lang,
  part: number,
): Promise<Buffer | null> {
  const file = posterPath(date, id, lang, part);
  if (!file) return null;
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

/**
 * Cache one poster. Returns whether it landed.
 *
 * Failure is swallowed on purpose: this is called from the request path as well
 * as from the job, and a full or read-only volume must not turn a working image
 * into a 500. The caller already has the bytes it needs.
 */
export async function writePoster(
  date: string,
  id: string,
  lang: Lang,
  part: number,
  bytes: Buffer,
): Promise<boolean> {
  const file = posterPath(date, id, lang, part);
  if (!file) return false;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    /**
     * Written to a temporary name and renamed into place, because two requests
     * for the same missing poster race — the sheet asks for every part at once,
     * and a crawler can arrive mid-render. `rename` is atomic within a
     * filesystem, so a reader sees either no file or a whole one, never the
     * prefix of a PNG another process is still writing.
     */
    const temp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temp, bytes);
    await fs.rename(temp, file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop every cached poster of the named articles, in the named languages.
 *
 * INVALIDATION, and the only kind this cache has. Nothing here re-renders: the
 * next request for one of these images misses, draws it from whatever the digest
 * says now, and keeps it — which is the same path a fresh container takes.
 *
 * IT IS REQUIRED WHERE A DIGEST IS EDITED AFTER THE FACT, which is exactly what
 * the English backfill does. The key is date + article + language + part and is
 * consulted before anything is drawn, so an `/en/…` poster drawn from the Chinese
 * take — back when that was all there was — would be served forever, and the
 * English page would share a Chinese image.
 *
 * BY PREFIX rather than by part number, because the part COUNT is not knowable
 * from here and changes with the text: the same take paginates wider in English,
 * so a day that cached three parts may now want five. Deleting `<anchor>-<lang>-`
 * takes whatever is actually there.
 *
 * Returns how many files went. Never throws — a file that will not delete is a
 * stale image, not a failed backfill.
 */
export async function dropPosters(
  date: string,
  ids: Iterable<string>,
  langs: Lang[],
): Promise<number> {
  if (!DATE_RE.test(date)) return 0;

  const dir = path.join(POSTER_DIR, date);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return 0; // nothing cached for that day
  }

  /** `<anchor>-<lang>-`, one per article per language: what a filename starts
   *  with if it belongs to this drop. Built from the same `articleAnchor` the
   *  path builder uses, so the two can only agree. */
  const prefixes: string[] = [];
  for (const id of ids) {
    const anchor = articleAnchor(id);
    if (!/^[0-9a-f]{1,40}$/.test(anchor)) continue;
    for (const lang of langs) prefixes.push(`${anchor}-${lang}-`);
  }
  if (!prefixes.length) return 0;

  let dropped = 0;
  for (const file of files) {
    if (!prefixes.some((prefix) => file.startsWith(prefix))) continue;
    try {
      await fs.rm(path.join(dir, file));
      dropped += 1;
    } catch {
      // Leaves one stale image behind. Not worth failing a run over.
    }
  }
  return dropped;
}

/**
 * Drop cached days older than KEEP_DAYS, counting back from `newest`.
 *
 * Called by the daily job once the day's digest is written. NOT because the
 * cache grew — it does not grow at write time any more, the posters are drawn on
 * first share — but because a cache on a mounted volume needs something that runs
 * on a schedule to take the far end off, and the daily run is the only thing here
 * that does. Compares date STRINGS: `YYYY-MM-DD` sorts chronologically, which is
 * the whole reason the digests are named that way.
 */
export async function prunePosters(newest: string): Promise<number> {
  if (!DATE_RE.test(newest)) return 0;
  const cutoff = new Date(`${newest}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - KEEP_DAYS);
  const oldest = cutoff.toISOString().slice(0, 10);

  let days: string[];
  try {
    days = await fs.readdir(POSTER_DIR);
  } catch {
    return 0; // nothing cached yet
  }

  let dropped = 0;
  for (const day of days) {
    // Anything that is not a date directory is not ours to delete.
    if (!DATE_RE.test(day) || day >= oldest) continue;
    try {
      await fs.rm(path.join(POSTER_DIR, day), { recursive: true, force: true });
      dropped += 1;
    } catch {
      // A day that will not delete is a day that stays. Not worth failing a run.
    }
  }
  return dropped;
}
