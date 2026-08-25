import { dateKey } from "@/lib/config";
import {
  CATEGORIES,
  FALLBACK_CATEGORY,
  PUBLISH_MIN_SCORE,
} from "@/lib/categories";
import { fetchAll } from "@/lib/fetcher";
import { notify } from "@/lib/notify";
import { commitAndPush, ensureRepo } from "@/lib/repo";
import { sourceOf } from "@/lib/sources";
import {
  readDigest,
  readWorking,
  relPathFor,
  writeDigest,
  type WorkingArticle,
  type WorkingDigest,
} from "@/lib/store";
import { cachePosters } from "@/jobs/posters";
import {
  scoreAll,
  summarizeSurvivors,
  verdictsFrom,
  type Verdict,
} from "@/lib/summarize";
import type { RawArticle } from "@/lib/fetcher";
import type {
  Article,
  Digest,
  FoldedArticle,
  RejectedArticle,
  ScoreFinding,
} from "@/lib/types";

/**
 * One lock for everything that touches the clone. The daily job and the
 * periodic sync both run git in the same working tree, and a fetch landing
 * mid-rebase would corrupt it.
 */
let running = false;

/**
 * Pull without generating anything.
 *
 * The pages read the clone off local disk, and the clone only used to move
 * when the container booted or the daily job fired. Anything pushed from
 * somewhere else — a laptop run, a backfill — stayed invisible to the site
 * until the next 07:00. This closes that window; it costs one `git fetch` and
 * never calls the model.
 */
export async function syncRepo(): Promise<boolean> {
  if (running) return false; // the daily run does its own pull
  running = true;
  try {
    await ensureRepo();
    return true;
  } finally {
    running = false;
  }
}

export interface RunOptions {
  /**
   * Do nothing if the repo already carries a digest for today.
   *
   * The scheduled run sets this: the day may already have been generated
   * somewhere else (a laptop run, an earlier container), and regenerating
   * would rewrite the file and pay for the model a second time for the same
   * day. A manual `npm run once` leaves it off so re-running is still possible.
   */
  skipIfPublished?: boolean;
}

/**
 * Fetch the day, score it, and fold that into whatever the day already has.
 *
 * SCORE OWNS THREE FIELDS AND ONLY THREE: `score`, `modelScore` and `review`.
 * Anything the summary pass wrote — the take, the section, the Chinese
 * headline — is carried across by id, so re-scoring a day that has already
 * been summarized costs the scoring pass and nothing else, and the summary
 * pass afterwards has nothing left to write.
 *
 * Every fetched article lands in `articles`, under the floor as well as over
 * it, because a score edited by hand has to be able to promote one. The floor
 * is applied later, by `publishFrom`.
 */
async function fetchAndScore(
  now: Date,
  existing: WorkingDigest | null,
): Promise<WorkingDigest> {
  const date = dateKey(now);

  const { articles: raw, statuses, window } = await fetchAll(now);
  console.log(
    `[daily] fetched ${raw.length} article(s) from ` +
      `${statuses.filter((s) => s.ok).length}/${statuses.length} source(s)`,
  );

  const verdicts = await scoreAll(raw);
  const carried = new Map(
    (existing?.articles ?? []).map((article) => [article.id, article]),
  );

  const articles: WorkingArticle[] = raw
    .map((article) => {
      const verdict = verdicts.get(article.id);
      const before = carried.get(article.id);
      return {
        id: article.id,
        sourceId: article.sourceId,
        // The summary pass decides the section; until it has run this is the
        // fallback, not a classification anyone made.
        category: before?.category ?? FALLBACK_CATEGORY,
        title: article.title,
        ...(before?.titleZh ? { titleZh: before.titleZh } : {}),
        url: article.url,
        author: article.author,
        publishedAt: article.publishedAt,
        image: article.image,
        readingMinutes: article.readingMinutes,
        score: verdict?.score ?? 0,
        // Always written here, and the baseline the file is read against: an
        // edited `score` is only recognisable as edited because this one did
        // not move with it.
        modelScore: verdict?.score ?? 0,
        rank: 0,
        ...(verdict?.judged ? { review: verdict.review } : {}),
        body: article.body,
        ...(before?.summary ? { summary: before.summary } : {}),
      };
    })
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
    .map((article, i) => ({ ...article, rank: i + 1 }));

  return {
    date,
    generatedAt: now.toISOString(),
    window: { from: window.from.toISOString(), to: window.to.toISOString() },
    stats: {
      fetched: raw.length,
      shown: articles.filter((a) => a.score >= PUBLISH_MIN_SCORE).length,
      folded: 0,
    },
    sources: statuses,
    articles,
    // Empty here and empty on the way out: nothing is folded any more, and
    // nothing is rejected until the floor runs in `publishFrom`.
    folded: [],
    rejected: [],
  };
}

/**
 * Turn the working digest into the published one: apply the floor to the scores
 * as they now stand, summarize what clears it and still needs a take, then
 * write, push, draw the posters and notify.
 *
 * SUMMARY OWNS THE FIELDS SCORE DOES NOT. It never rewrites a score — which is
 * also why an article whose `score` no longer matches its `modelScore` is
 * published saying so, rather than quietly rounded back.
 *
 * Assumes the clone is ready — every caller syncs first.
 */
async function publishFrom(
  working: WorkingDigest,
  now: Date,
): Promise<Digest> {
  const edited = working.articles.filter(
    (article) => article.score !== (article.modelScore ?? article.score),
  );
  if (edited.length) {
    console.log(
      `[daily] ${edited.length} score(s) set by hand: ` +
        edited
          .map((a) => `${a.modelScore}→${a.score} ${a.title}`)
          .join(" · "),
    );
  }

  // The summary pass wants RawArticles; the working file is exactly that plus
  // the judgement, so this is a projection rather than a re-fetch.
  const raw: RawArticle[] = working.articles.map((article) => ({
    id: article.id,
    sourceId: article.sourceId,
    title: article.title,
    url: article.url,
    author: article.author,
    publishedAt: article.publishedAt,
    image: article.image,
    readingMinutes: article.readingMinutes,
    body: article.body,
  }));

  const verdicts: Map<string, Verdict> = verdictsFrom(
    working.articles.map((article) => ({
      id: article.id,
      judged: Boolean(article.review),
      score: article.score,
      review: article.review,
      category: article.category,
      titleZh: article.titleZh,
      summary: article.summary,
    })),
  );

  await summarizeSurvivors(raw, verdicts);

  // Rank purely by the score; ties fall back to recency so the ordering is
  // deterministic.
  const sorted = [...raw].sort((a, b) => {
    const diff =
      (verdicts.get(b.id)?.score ?? 0) - (verdicts.get(a.id)?.score ?? 0);
    return diff !== 0 ? diff : b.publishedAt.localeCompare(a.publishedAt);
  });

  /**
   * The publish floor: one rule, no exemptions — nothing below
   * PUBLISH_MIN_SCORE reaches the page.
   *
   * The score alone decides, so an article the score pass never spoke for is
   * dropped along with the ones it rejected: it carries 0, and 0 is below any
   * floor. That is deliberate. Unjudged articles USED to be exempted and
   * published as bare titles, on the reasoning that a model outage must not
   * empty the digest. What that actually bought was a page padded with empty
   * cards: the run of 2026-08-18 published 39 articles of which 18 were
   * unscored stubs — Open Thread 447, Monday assorted links — every one of
   * them something the floor would have rejected on merit had the call
   * succeeded. An honest empty digest beats a full page of nothing.
   *
   * The cost is real and accepted: if the score pass fails wholesale, the day
   * publishes nothing. `stats.fetched` and the per-source statuses still
   * record that the run happened, so the outage is visible in the file.
   *
   * "The score" means THE SCORE IN THE FILE, which a human may have written.
   * That does not weaken the rule — it is still one number against one floor,
   * and the digest records who set the number.
   */
  const ranked = sorted.filter(
    (item) =>
      sourceOf(item.sourceId).alwaysPublish ||
      (verdicts.get(item.id)?.score ?? 0) >= PUBLISH_MIN_SCORE,
  );

  // Only when the score pass actually spoke. An article it never answered for
  // would otherwise carry five zeroes, which reads like a review that scored
  // everything at rock bottom rather than a review that never happened.
  //
  // Typed as ScoreFinding rather than inferred: `Object.values` on an
  // interface with no index signature falls back to `any[]`, so the previous
  // version of this check tested `.length` on what are now objects and
  // silently evaluated false for every article — no review reached the file.
  const reviewOf = (id: string) => {
    const review = verdicts.get(id)?.review;
    const filled =
      review &&
      (Object.values(review) as ScoreFinding[]).some(
        (finding) => finding.score > 0,
      );
    return filled ? { review } : {};
  };

  /** The two fields that say a human overruled the model. Written only when
   *  the numbers actually differ: in the working file `modelScore` is always
   *  present, and carrying it into the published record unconditionally would
   *  make "nobody touched this" and "someone agreed with the model" look the
   *  same. */
  const byId = new Map(working.articles.map((a) => [a.id, a]));
  const overrideOf = (id: string) => {
    const article = byId.get(id);
    return article && article.modelScore !== undefined &&
      article.modelScore !== article.score
      ? { modelScore: article.modelScore, scoredBy: "human" as const }
      : {};
  };

  // The complement of `ranked`, kept because a rejection is a decision worth
  // being able to look up later — it goes into the file, never onto the page.
  const rejected: RejectedArticle[] = sorted
    .filter((item) => !ranked.includes(item))
    .map((item) => ({
      title: item.title,
      url: item.url,
      sourceId: item.sourceId,
      score: verdicts.get(item.id)?.score ?? 0,
      ...reviewOf(item.id),
      ...overrideOf(item.id),
    }));

  if (rejected.length) {
    console.log(
      `[daily] dropped ${rejected.length} article(s) below ` +
        `the publish floor (${PUBLISH_MIN_SCORE}): ` +
        rejected.map((item) => `${item.score} ${item.title}`).join(" · "),
    );
  }

  // Everything that clears the floor is published, and every published
  // article gets a full card. No per-source quota, no overflow, nothing
  // folded: an article's section comes from the model's classification and
  // its place inside that section from its score. This filter is the page's
  // only gate — the components draw whatever survives it.
  const perCategory = new Map<string, number>();
  for (const item of ranked) {
    const category = verdicts.get(item.id)?.category ?? FALLBACK_CATEGORY;
    perCategory.set(category, (perCategory.get(category) ?? 0) + 1);
  }
  console.log(
    `[daily] sections — ${CATEGORIES.map(
      (c) => `${c.name} ${perCategory.get(c.id) ?? 0}`,
    ).join(", ")}`,
  );

  /**
   * An article over the floor with no take is not publishable, and this is
   * where that becomes visible rather than shipping an empty card. It happens
   * when the summary pass fails for one article after its retries.
   */
  const unsummarized = ranked.filter(
    (item) => !verdicts.get(item.id)?.zh.thesis,
  );
  if (unsummarized.length) {
    console.error(
      `[daily] ${unsummarized.length} article(s) cleared the floor but have ` +
        `no summary and are being held back: ` +
        unsummarized.map((item) => item.title).join(" · "),
    );
  }

  const articles: Article[] = ranked
    .filter((item) => verdicts.get(item.id)!.zh.thesis)
    .map((item, i) => {
      const verdict = verdicts.get(item.id)!;
      return {
        id: item.id,
        sourceId: item.sourceId,
        category: verdict.category,
        title: item.title,
        // Omitted rather than stored empty, so the field's absence means the
        // same thing in a digest written today as in one written before it
        // existed: there is no Chinese headline to show.
        ...(verdict.titleZh ? { titleZh: verdict.titleZh } : {}),
        url: item.url,
        author: item.author,
        publishedAt: item.publishedAt,
        image: item.image,
        readingMinutes: item.readingMinutes,
        score: verdict.score,
        ...overrideOf(item.id),
        rank: i + 1,
        ...reviewOf(item.id),
        // The English half only when it came back — the field's absence is how a
        // renderer knows to fall back, and writing an empty one would make
        // "no English take" indistinguishable from "an English take that is blank".
        summary: {
          zh: verdict.zh,
          ...(verdict.en ? { en: verdict.en } : {}),
        },
      };
    });

  // Kept in the contract, always empty from here on: archived digests still
  // carry entries and the page still renders them.
  const folded: FoldedArticle[] = [];

  const digest: Digest = {
    date: working.date,
    generatedAt: now.toISOString(),
    // From the working file, not recomputed: `npm run summary` can run hours
    // after the scoring, and a window derived from ITS clock would claim the
    // day scanned a stretch of time it never looked at.
    window: working.window,
    stats: {
      fetched: working.articles.length,
      shown: articles.length,
      folded: folded.length,
    },
    sources: working.sources,
    articles,
    folded,
    rejected,
  };

  // Writing the same path the working file lives at is what drops the bodies:
  // `digest` has no `body` anywhere, so the file that lands in git is the
  // published shape and nothing has to strip anything.
  const rel = await writeDigest(digest);
  await commitAndPush(
    [rel],
    `daily: ${digest.date} — ${digest.stats.fetched} article(s)`,
  );

  /**
   * Every share image, rendered now and written to disk.
   *
   * AFTER the push and BEFORE the notification, which is the one ordering that
   * makes sense: the digest is the record and it should be safe in git before
   * this spends a minute on derived files, and the notification is what sends a
   * reader to the site — so the images should already be there when they arrive
   * to share one.
   *
   * It cannot fail the run. The posters are a cache; the route renders on a
   * miss, so the worst case of this whole step failing is the old behaviour.
   */
  await cachePosters(digest);

  await notify(digest);

  console.log(
    `[daily] run done — ${digest.stats.shown} shown, ` +
      `${digest.stats.folded} folded`,
  );
  return digest;
}

/**
 * One full run: pull → fetch → score → summarize → rank → write JSON → push →
 * notify. What the cron fires, and what `npm run once` still does.
 *
 * The digest is written and pushed even when nothing was found, so every date
 * has a file and the site can render an honest "今日无更新" instead of silently
 * showing yesterday.
 *
 * It never writes the working file: the two halves run back to back in memory,
 * so the only thing that reaches disk is the published digest. A scheduled run
 * that stopped in the middle would otherwise leave the clone dirty and the day
 * half-written, which is a worse failure than the one it would be recovering
 * from.
 *
 * Returns null only when `skipIfPublished` short-circuited the run.
 */
export async function runDaily(
  now = new Date(),
  options: RunOptions = {},
): Promise<Digest | null> {
  if (running) throw new Error("a run is already in progress");
  running = true;

  try {
    const date = dateKey(now);
    console.log(`[daily] run start — ${date}`);

    await ensureRepo();

    // AFTER the pull, never before: a clone that is behind origin would report
    // today as missing and regenerate a day that already exists upstream.
    if (options.skipIfPublished) {
      const published = await readDigest(date);
      if (published) {
        console.log(
          `[daily] ${date} is already published ` +
            `(${published.stats.fetched} article(s), generated ` +
            `${published.generatedAt}) — skipping`,
        );
        return null;
      }
    }

    const working = await fetchAndScore(now, null);
    return await publishFrom(working, now);
  } finally {
    running = false;
  }
}

/**
 * The first half alone: `npm run score`.
 *
 * Writes the day's digest file with every fetched article and its score, and
 * stops there — no commit, no push, no summaries. The file is left dirty in
 * the clone on purpose: that is the thing you open and edit.
 *
 * It pulls first and reads what is already there, so re-scoring a day that has
 * been summarized keeps the takes.
 */
export async function runScore(
  now = new Date(),
): Promise<{ working: WorkingDigest; path: string }> {
  if (running) throw new Error("a run is already in progress");
  running = true;

  try {
    const date = dateKey(now);
    console.log(`[daily] score start — ${date}`);

    await ensureRepo();
    const existing = await readWorking(date);

    const working = await fetchAndScore(now, existing);
    const rel = await writeDigest(working);
    return { working, path: rel };
  } finally {
    running = false;
  }
}

/**
 * The second half alone: `npm run summary`.
 *
 * Reads the day's file — including any score edited in it — summarizes what
 * clears the floor and has no take yet, and publishes.
 *
 * THE READ HAPPENS BEFORE `ensureRepo()`, which is the opposite of the ordering
 * every other path here uses and is not an oversight: the scores you edited are
 * uncommitted working-tree changes, and the sync resets the clone hard to
 * origin whenever there is nothing local to preserve. Reading first means the
 * edits are already in memory when that happens.
 *
 * Throws when the file has no bodies — a published digest carries none, so this
 * is "that day was already finished, or was never scored". Falling back to a
 * fresh fetch would be the more helpful-looking behaviour and the wrong one:
 * this command exists to publish the scores you looked at.
 */
export async function runPublish(
  date: string,
  now = new Date(),
): Promise<Digest> {
  if (running) throw new Error("a run is already in progress");
  running = true;

  try {
    const working = await readWorking(date);
    if (!working) {
      throw new Error(
        `no digest for ${date} at ${relPathFor(date)} — run ` +
          `\`npm run score\` first`,
      );
    }
    if (!working.articles.some((article) => article.body)) {
      throw new Error(
        `${date} carries no article bodies, so it is already published (or ` +
          `was never scored) — run \`npm run score\` to start it again`,
      );
    }

    await ensureRepo();

    console.log(
      `[daily] publish start — ${date} ` +
        `(${working.articles.length} scored at ${working.generatedAt})`,
    );
    return await publishFrom(working, now);
  } finally {
    running = false;
  }
}
