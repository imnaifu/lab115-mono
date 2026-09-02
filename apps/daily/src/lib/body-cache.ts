import fs from "node:fs/promises";
import path from "node:path";
import { bodyFor } from "./fetcher";
import { DATA_PATH } from "./paths";

/**
 * Article bodies, kept on disk next to the digest clone.
 *
 * THE PUBLISHED DIGEST DOES NOT CARRY BODIES and never should — it is the file
 * the page reads and the file that gets pushed, and 146 archived articles are
 * around 3MB of plain text that no reader needs. But re-scoring an archived day
 * needs them, and the only other way to get one back is to re-fetch the article
 * page: by then the feed has rotated past it, so it is a request to the original
 * site, and a paywall or a dead link means the body cannot be recovered at all.
 * A body fetched once is worth keeping forever.
 *
 * KEYED BY ARTICLE ID, which is the sha1 of the canonical URL and therefore
 * stable across runs — the same article re-fetched tomorrow lands on the same
 * key. Grouped one file per day so a day can be read in one go, which is how
 * every caller wants it.
 *
 * `data/` is gitignored, so this is local to whatever machine ran the fetch. It
 * is a cache and it is allowed to be incomplete: a missing entry means "not
 * fetched yet or not recoverable", and every caller has to handle a body that
 * is not there, exactly as the scoring pass already handles an empty body.
 */
const BODIES_PATH = path.join(DATA_PATH, "bodies");

/** Empty string is a REAL, CACHED ANSWER: "this page could not be brought
 *  back". Storing it stops every later run from asking the site again. */
export type BodyCache = Record<string, string>;

function fileFor(date: string): string {
  return path.join(BODIES_PATH, `${date}.json`);
}

export async function readBodies(date: string): Promise<BodyCache> {
  try {
    return JSON.parse(await fs.readFile(fileFor(date), "utf8")) as BodyCache;
  } catch {
    return {};
  }
}

export async function writeBodies(
  date: string,
  bodies: BodyCache,
): Promise<void> {
  await fs.mkdir(BODIES_PATH, { recursive: true });
  await fs.writeFile(fileFor(date), `${JSON.stringify(bodies, null, 2)}\n`);
}

/**
 * Fill in whatever is missing for one day and return the whole cache for it.
 *
 * Only asks for ids the file does not already have — including the ones cached
 * as "" — so running it twice costs nothing. Writes once at the end rather than
 * per article: a run that dies halfway loses that day's new fetches, which is
 * cheaper than 30 rewrites of the same file.
 */
export async function fetchMissingBodies(
  date: string,
  articles: Array<{ id: string; url: string }>,
  concurrency = 6,
  onFetched?: (id: string, chars: number) => void,
): Promise<{ bodies: BodyCache; fetched: number; empty: number }> {
  const bodies = await readBodies(date);
  const missing = articles.filter((article) => !(article.id in bodies));
  let empty = 0;

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, missing.length) }, async () => {
      while (cursor < missing.length) {
        const article = missing[cursor++];
        const body = await bodyFor(article.url);
        bodies[article.id] = body;
        if (!body) empty += 1;
        onFetched?.(article.id, body.length);
      }
    }),
  );

  if (missing.length) await writeBodies(date, bodies);
  return { bodies, fetched: missing.length, empty };
}
