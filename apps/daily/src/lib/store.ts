import fs from "node:fs/promises";
import path from "node:path";
import { REPO_SUBDIR } from "./config";
import { articleSlug, idFromSlug } from "./links";
import { REPO_PATH } from "./paths";
import type { ScoredEntry } from "./stats";
import type { Article, Digest, PublishedArticle } from "./types";

/**
 * Read/write side of the git clone. There is no index file: the archive list
 * is produced by walking the directory, so the filesystem and the repo can
 * never disagree about which days exist.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `daily/2026/08/2026-08-10.json`, relative to the repo root. */
export function relPathFor(date: string): string {
  const [year, month] = date.split("-");
  return path.join(REPO_SUBDIR, year, month, `${date}.json`);
}

function absPathFor(date: string): string {
  return path.join(REPO_PATH, relPathFor(date));
}

/**
 * THE HALF-DONE DIGEST: what `npm run score` leaves on disk for `npm run
 * summary` to finish, written to the SAME path as the published file.
 *
 * There is no separate plan file, and that is the point — the thing you edit is
 * the thing that gets published, so there is no second format to learn and no
 * question of which one is authoritative. Two commands, two halves of the
 * record: `score` writes `score` / `modelScore` / `review`, `summary` writes
 * `summary` / `category` / `titleZh`, and neither reads the other's back to
 * decide anything.
 *
 * ONE difference from a published digest, and it is temporary: every article
 * carries its `body`. The summary pass needs it, and re-fetching instead would
 * mean summarizing a different text than the one that was scored — an HN item's
 * third-party page can be gone hours later. Nothing strips them on the way out:
 * `publishFrom` builds `Digest` objects, which have no `body` field anywhere.
 *
 * The list itself does not change shape. A digest already holds every article
 * the window produced, published or not (see `Digest.articles`), so the
 * half-done file is that same list with no takes written yet.
 *
 * IT IS NEVER COMMITTED. `score` writes the file and stops; the working tree is
 * dirty until `summary` runs. That is also why `summary` reads this file BEFORE
 * calling `ensureRepo()` — the sync does `git reset --hard origin/BRANCH` when
 * there is nothing local to preserve, which would throw the edited scores away.
 */
export interface WorkingArticle extends Article {
  /**
   * Plain text, already truncated to BODY_CHAR_LIMIT — see RawArticle.
   *
   * Optional because this type also reads back a PUBLISHED digest, which
   * carries none. An article with no body cannot be summarized; it is held back
   * and said so, rather than summarized from its headline.
   */
  body?: string;
}

export interface WorkingDigest extends Omit<Digest, "articles"> {
  articles: WorkingArticle[];
}

/** null when that day was never scored — or when it was published, since a
 *  published digest carries no bodies. The caller decides what that means. */
export async function readWorking(date: string): Promise<WorkingDigest | null> {
  const digest = (await readDigest(date)) as WorkingDigest | null;
  return digest;
}

/**
 * The articles a page shows: the ones that came back with a take.
 *
 * THE ONE PLACE THE FLOOR IS READ BACK. A digest carries every article the
 * window held in a single list — see `Digest.articles` — and `summary` is what
 * separates the published from the merely considered. Every renderer goes
 * through here, which is why it returns the narrowed type: a component that
 * reached into `digest.articles` itself would be handed entries with no take
 * and would not compile.
 *
 * Order is preserved, and the writer already sorted the list by rank.
 */
export function shownArticles(digest: Digest): PublishedArticle[] {
  return digest.articles.filter(
    (article): article is PublishedArticle => article.summary !== undefined,
  );
}

export async function writeDigest(
  digest: Digest | WorkingDigest,
): Promise<string> {
  const rel = relPathFor(digest.date);
  const abs = path.join(REPO_PATH, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  return rel;
}

/** null when that day was never generated (or the clone isn't there yet). */
export async function readDigest(date: string): Promise<Digest | null> {
  if (!DATE_RE.test(date)) return null; // also blocks path traversal via [date]
  try {
    const raw = await fs.readFile(absPathFor(date), "utf8");
    return JSON.parse(raw) as Digest;
  } catch {
    return null;
  }
}

/** Every generated date, newest first. Walks daily/<yyyy>/<mm>/. */
export async function listDates(): Promise<string[]> {
  const root = path.join(REPO_PATH, REPO_SUBDIR);
  const dates: string[] = [];

  let years: string[];
  try {
    years = await fs.readdir(root);
  } catch {
    return []; // repo not cloned yet — the pages render an empty state
  }

  for (const year of years) {
    let months: string[];
    try {
      months = await fs.readdir(path.join(root, year));
    } catch {
      continue;
    }
    for (const month of months) {
      let files: string[];
      try {
        files = await fs.readdir(path.join(root, year, month));
      } catch {
        continue;
      }
      for (const file of files) {
        const date = file.replace(/\.json$/, "");
        if (file.endsWith(".json") && DATE_RE.test(date)) dates.push(date);
      }
    }
  }

  return dates.sort().reverse();
}

/** The most recent digest on disk — what `/` falls back to before the first
 *  run of the day has happened. */
export async function readLatest(): Promise<Digest | null> {
  const [newest] = await listDates();
  return newest ? readDigest(newest) : null;
}

/**
 * One article by date and id PREFIX, plus the digest it came from.
 *
 * Prefix rather than exact match so an old full-length link keeps working after
 * links got shortened — `startsWith` accepts both.
 */
export async function readArticle(
  date: string,
  idPrefix: string,
): Promise<{ digest: Digest; article: PublishedArticle } | null> {
  if (!/^[0-9a-f]{4,40}$/.test(idPrefix)) return null;
  const digest = await readDigest(date);
  // Published only: this is what the poster route resolves, and an article with
  // no take has no poster to draw either.
  const article = digest
    ? shownArticles(digest).find((a) => a.id.startsWith(idPrefix))
    : undefined;
  return digest && article ? { digest, article } : null;
}

/**
 * One article by the last segment of its URL, which is now `<slug>-<id>`.
 *
 * TWO LOOKUPS, IN THIS ORDER, and the order is the whole correctness argument.
 *
 * The exact slug match comes first because it cannot be fooled. `idFromSlug` can
 * be: hex digits are also letters, so a headline ending in a word spelled from
 * `a-f` would hand back an id that names nothing, and falling through to it first
 * would 404 a URL this site itself generated.
 *
 * The id match is second, and it is what makes every link ever shared keep
 * working — the eight-character URLs from before slugs existed, a link whose
 * headline has since been edited, a URL someone retyped without the words. It
 * also reports whether the segment it was handed is the canonical one, so the
 * page can 308 to the right URL instead of serving the same article at two
 * addresses. That flag is the reason this returns a shape rather than an article.
 */
export async function readArticleBySlug(
  date: string,
  segment: string,
): Promise<{
  digest: Digest;
  article: PublishedArticle;
  canonical: boolean;
} | null> {
  const digest = await readDigest(date);
  if (!digest) return null;

  // `shownArticles`, not `digest.articles`: an article with no take has no page,
  // and resolving a slug to one would render a headline over an empty card.
  const shown = shownArticles(digest);

  const exact = shown.find((a) => articleSlug(a) === segment);
  if (exact) return { digest, article: exact, canonical: true };

  const id = idFromSlug(segment);
  if (!id) return null;
  const byId = shown.find((a) => a.id.startsWith(id));
  return byId ? { digest, article: byId, canonical: false } : null;
}

/** One published take, with the day it ran. */
export interface SourceArticle {
  date: string;
  article: PublishedArticle;
}

let sourceIndex: {
  key: string;
  at: number;
  value: Map<string, SourceArticle[]>;
} | null = null;

/** How long the index may be trusted without re-reading the archive. See the
 *  TTL paragraph on `articlesBySource` below for what the ten minutes are for. */
const SOURCE_INDEX_TTL_MS = 10 * 60_000;

/**
 * Every published take, grouped by the blog it was written about — newest day
 * first, and within a day in the order the digest ranked them.
 *
 * ONE WALK FOR THREE CALLERS. `/s` needs a count per source, `/s/<id>` needs one
 * source's whole run, and the sitemap needs to know which sources clear
 * `SOURCE_MIN_ARTICLES`. Those are the same question asked three ways, and asking
 * it three times would be three passes over the archive that could disagree about
 * where the line falls.
 *
 * IT READS EVERY DIGEST, and there is no index to read instead — that is the
 * deliberate absence at the top of this file, and the reason a source page cannot
 * be assembled cheaply: `sourceId` lives inside each article, so the only way to
 * know which days mention a blog is to open all of them. The sitemap already pays
 * exactly this cost for exactly this reason.
 *
 * IT CANNOT BE ANSWERED BY ISR, and that is worth writing down because it was
 * the obvious plan and it does not work here. `app/sitemap.ts` pays this same
 * cost behind `revalidate = 3600`; a PAGE cannot, because the root layout reads
 * `headers()` to get the language the proxy resolved (see the note in
 * app/layout.tsx), and a dynamic API in a layout makes every route beneath it
 * dynamic. Every `[lang]` page is `force-dynamic` for that reason, so a source
 * page would walk the whole archive on every single request, crawler included.
 *
 * HENCE THE CACHE ABOVE rather than a smarter query. The archive is append-only
 * in practice — a digest is written on its day and not edited — so the pair
 * (how many days, which is newest) identifies the content of the whole run, and
 * that pair costs one directory walk to check against a hundred file reads to
 * rebuild.
 *
 * THE TTL IS FOR THE ONE CASE THAT PAIR MISSES: `backfill-summary` rewrites
 * archived digests in place, changing neither the count nor the newest date. It
 * is a rare manual job, and ten minutes of a stale index after it is a smaller
 * problem than an invalidation scheme that has to know about it.

 * Sequential, not `Promise.all`: this is a hundred small reads off local disk on a
 * request no reader is waiting behind, and fanning them out all at once is how a
 * growing archive turns one page render into an EMFILE.
 */
export async function articlesBySource(): Promise<Map<string, SourceArticle[]>> {
  const dates = await listDates();
  const key = `${dates.length}:${dates[0] ?? ""}`;
  if (
    sourceIndex &&
    sourceIndex.key === key &&
    Date.now() - sourceIndex.at < SOURCE_INDEX_TTL_MS
  ) {
    return sourceIndex.value;
  }

  const bySource = new Map<string, SourceArticle[]>();

  for (const date of dates) {
    const digest = await readDigest(date);
    if (!digest) continue;
    // Published only, the same filter the sitemap and every renderer use: an
    // article with no take has no page to link to and nothing to show in a row.
    for (const article of shownArticles(digest)) {
      const run = bySource.get(article.sourceId);
      if (run) run.push({ date, article });
      else bySource.set(article.sourceId, [{ date, article }]);
    }
  }

  sourceIndex = { key, at: Date.now(), value: bySource };
  return bySource;
}

/**
 * Every article the scorer has ever answered for — published AND turned down,
 * across both shapes of digest file.
 *
 * THE ONLY READER THAT WANTS THE REJECTIONS. Everything on the reader's side of
 * this app goes through `shownArticles`, which is the rule "no take means it was
 * not published" stated once. `/admin` is the exception the rejections exist for:
 * `Digest.articles` keeps them, and `RejectedArticle` is still declared, so that
 * a run can be audited after the fact — "why is that post missing" — and that
 * audit is the page this feeds.
 *
 * TWO SHAPES, UNIONED HERE. Digests from 2026-08-26 on hold one merged list; the
 * six days before that split it into `articles` (published only) plus `rejected`.
 * Reading only the merged field would silently drop 58 turned-down articles from
 * those days and make the early archive look like a scorer that rejected nothing.
 *
 * NOT CACHED, unlike `articlesBySource` next door, and that is the difference in
 * who asks. That one is on `/s`, which crawlers hit; this one is behind a
 * password with one reader, so a full walk per render is a cost nobody is
 * waiting behind — and a stale statistic on a tuning page is worse than a slow
 * one, because the whole point is to see what this morning's run did.
 */
export async function allScored(): Promise<ScoredEntry[]> {
  const entries: ScoredEntry[] = [];

  for (const date of await listDates()) {
    const digest = await readDigest(date);
    if (!digest) continue;

    for (const article of digest.articles) {
      entries.push({
        date,
        title: article.title,
        url: article.url,
        sourceId: article.sourceId,
        score: article.score,
        modelScore: article.modelScore,
        scoredBy: article.scoredBy,
        review: article.review,
        // The one field that says whether it ran. Read, never recomputed: this
        // day was published under whatever the rules were that morning.
        published: article.summary !== undefined,
        publishedAt: article.publishedAt,
        category: article.category,
      });
    }

    /**
     * The legacy list. `RejectedArticle` carries four fields and no `id`,
     * `category` or `publishedAt` — see the type — so those come back undefined
     * and the statistics that need them say so rather than inventing a value.
     */
    for (const rejected of digest.rejected ?? []) {
      entries.push({
        date,
        title: rejected.title,
        url: rejected.url,
        sourceId: rejected.sourceId,
        score: rejected.score,
        modelScore: rejected.modelScore,
        scoredBy: rejected.scoredBy,
        review: rejected.review,
        published: false,
      });
    }
  }

  return entries;
}
