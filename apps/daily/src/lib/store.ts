import fs from "node:fs/promises";
import path from "node:path";
import { REPO_SUBDIR } from "./config";
import { articleSlug, idFromSlug } from "./links";
import { REPO_PATH } from "./paths";
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
