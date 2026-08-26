import { dateKey } from "@/lib/config";
import {
  CATEGORIES,
  FALLBACK_CATEGORY,
  PUBLISH_MIN_SCORE,
} from "@/lib/categories";
import { fetchAll } from "@/lib/fetcher";
import { mailDigest } from "@/jobs/mail";
import { notify } from "@/lib/notify";
import { dailyPhoto } from "@/lib/photo";
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
 * Fetch the day and score it — the whole of `npm run score`.
 *
 * IT WRITES A CLEAN SLATE. Everything in the file it replaces is replaced:
 * there is no merge with what was there before, no carrying over of takes
 * written earlier, no branch on whether the day was already published. What
 * comes out is one thing — every article the window holds, each with a score —
 * and that is the only shape `npm run summary` ever has to read.
 *
 * The alternative was tried and it is worse than it looks. Carrying the takes
 * across makes re-scoring cheap, and it makes the file's contents depend on
 * what happened to be in it: the same command, run twice on the same day, has
 * different output the second time, and every reader downstream needs a branch
 * for "the summaries might already be here". A day is cheap to re-summarize
 * compared to being unable to say what a file contains.
 *
 * Every fetched article lands in `articles`, under the floor as well as over
 * it, because a score edited by hand has to be able to promote one. The floor
 * is applied later, by `publishFrom`.
 */
async function fetchAndScore(now: Date): Promise<WorkingDigest> {
  const date = dateKey(now);

  const { articles: raw, statuses, window } = await fetchAll(now);
  console.log(
    `[daily] fetched ${raw.length} article(s) from ` +
      `${statuses.filter((s) => s.ok).length}/${statuses.length} source(s)`,
  );

  const verdicts = await scoreAll(raw);

  const articles: WorkingArticle[] = raw
    .map((article) => {
      const verdict = verdicts.get(article.id);
      return {
        id: article.id,
        sourceId: article.sourceId,
        // The summary pass decides the section. Until it runs this is the
        // fallback, not a classification anyone made.
        category: FALLBACK_CATEGORY,
        title: article.title,
        url: article.url,
        author: article.author,
        publishedAt: article.publishedAt,
        image: article.image,
        readingMinutes: article.readingMinutes,
        score: verdict?.score ?? 0,
        // Always written, and the baseline the file is read against: an edited
        // `score` is only recognisable as edited because this one did not move
        // with it.
        modelScore: verdict?.score ?? 0,
        rank: 0,
        ...(verdict?.judged ? { review: verdict.review } : {}),
        body: article.body,
      };
    })
    .sort(
      (a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt),
    )
    .map((article, i) => ({ ...article, rank: i + 1 }));

  return {
    date,
    generatedAt: now.toISOString(),
    window: { from: window.from.toISOString(), to: window.to.toISOString() },
    stats: {
      fetched: raw.length,
      shown: articles.filter((a) => a.score >= PUBLISH_MIN_SCORE).length,
    },
    sources: statuses,
    articles,
  };
}

/**
 * Turn the working digest into the published one: apply the floor to the scores
 * as they now stand, summarize what clears it and still needs a take, then
 * write, push and notify.
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
    // "" rather than undefined: an article the fetch could not bring back is
    // one with no text, which is a state the summary pass already understands.
    body: article.body ?? "",
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

  /**
   * The model's own number, and whether something overruled it.
   *
   * `modelScore` IS ALWAYS WRITTEN. It was briefly written only when it
   * differed, to save a field on the articles nobody had touched — and that
   * made editing a score in an already-published digest untraceable, because
   * the file it was edited in had no baseline to compare against. The baseline
   * has to survive in the published record for the trace to mean anything.
   */
  const byId = new Map(working.articles.map((a) => [a.id, a]));
  const scoringOf = (id: string) => {
    const article = byId.get(id);
    const model = article?.modelScore;
    if (model === undefined) return {};
    return {
      modelScore: model,
      ...(model !== article!.score ? { scoredBy: "human" as const } : {}),
    };
  };


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

  /** What actually reaches the page: over the floor AND carrying a take. */
  const published = new Set(
    ranked
      .filter((item) => verdicts.get(item.id)!.zh.thesis)
      .map((item) => item.id),
  );
  console.log(
    `[daily] ${published.size} published, ` +
      `${sorted.length - published.size} not`,
  );

  /**
   * ONE LIST: every article the day held, published or not.
   *
   * `summary` is what separates them, and `rank` is only meaningful on the ones
   * that have it — see `Digest.articles`. Sorted by score throughout, so the
   * file reads top to bottom as the day's ranking with the cut-off somewhere in
   * the middle.
   *
   * IT WAS TWO LISTS. `articles` held what shipped and `rejected` held four
   * fields per turned-down article, and the split cost more than it bought:
   * acting on a rejection later meant reconstructing an article from a title
   * and a url, and the two lists had to be kept in step by whoever wrote them
   * — the first version of that dropped every article that was over the floor
   * with no summary, which landed in neither.
   */
  let position = 0;
  const articles: Article[] = sorted.map((item) => {
    const verdict = verdicts.get(item.id)!;
    const take = verdict.zh.thesis
      ? {
          // The English half only when it came back — the field's absence is
          // how a renderer knows to fall back, and writing an empty one would
          // make "no English take" indistinguishable from "an English take
          // that is blank".
          summary: {
            zh: verdict.zh,
            ...(verdict.en ? { en: verdict.en } : {}),
          },
        }
      : {};
    const shown = published.has(item.id);
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
      ...scoringOf(item.id),
      // Position among the PUBLISHED articles. 0 on the rest: they have no
      // place on a page, and numbering them would make one field two measures.
      rank: shown ? (position += 1) : 0,
      ...reviewOf(item.id),
      ...take,
    };
  });

  /**
   * The photograph, resolved BEFORE the literal below rather than inside it.
   *
   * `working.date`, not `now`: this step can run hours after the scoring (`npm
   * run summary`) or against a date long past (the backfill), and the day being
   * written is the day whose picture belongs on it — the same reasoning as the
   * `window` field just below.
   *
   * No try/catch here, and that is not an oversight: `dailyPhoto` returns null
   * for every failure it can have, precisely so that a slow Wikimedia cannot
   * take a day's takes down with it. A photo is decoration; the takes are the
   * product.
   */
  const photo = await dailyPhoto(working.date);

  const digest: Digest = {
    date: working.date,
    generatedAt: now.toISOString(),
    // From the working file, not recomputed: `npm run summary` can run hours
    // after the scoring, and a window derived from ITS clock would claim the
    // day scanned a stretch of time it never looked at.
    window: working.window,
    stats: {
      // Both read off the one list now: everything the day held, and the part
      // of it that reached the page.
      fetched: articles.length,
      shown: published.size,
    },
    sources: working.sources,
    articles,
    // Omitted rather than written as null, so a day with no photo looks the same
    // as a day from before there were photos — one absent field, one branch in
    // the renderer.
    ...(photo ? { photo } : {}),
    // NO `rejected`. It is a legacy field — archived digests carry one and
    // `Digest` still declares it so they parse — and writing it here would put
    // every turned-down article in the file twice.
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
   * The share images are NOT rendered here. They are drawn the first time
   * somebody actually opens a share sheet — see lib/poster-serve.ts.
   *
   * This step used to render every image of every article in both languages, on
   * the argument that one tap should not cost three to seven Satori renders. It
   * bought that at a fixed price: a minute of CPU every morning drawing the whole
   * day in both languages, most of which nobody shares. A cold render is ~0.6s for
   * the cover part and ~0.1s for each page of prose, the sheet asks for every part
   * at once, and it already has a four-second budget and a spinner to spend it
   * behind — see PREPARE_WAIT_MS in ShareButton. So the work is now paid for by
   * the shares that happen rather than by the ones that might.
   *
   * THE RETENTION SWEEP THAT USED TO CLOSE THIS STEP IS GONE TOO, along with the
   * disk cache it swept. Nothing this job does touches a poster now; they are
   * drawn per request and cached only by `cache-control`. See lib/poster-serve.
   */
  await notify(digest);

  /**
   * LAST, AND UNABLE TO FAIL THE RUN.
   *
   * Last because it is the slowest and least reversible thing here: the digest
   * is already committed, the posters are already on disk for whoever follows a
   * link, and Bark has already reached the one device that wanted to know. An
   * email cannot be recalled, so it goes when everything it points at is
   * standing.
   *
   * The catch is the same contract `notify` has. A Resend outage must not cost
   * the day its digest — `npm run mail -- <date>` sends it afterwards, and the
   * broadcast name makes that safe to run more than once.
   */
  await mailDigest(digest).catch((error) =>
    console.error("[daily] mail failed:", error),
  );

  console.log(
    `[daily] run done — ${digest.stats.shown} shown of ` +
      `${digest.stats.fetched} in the file`,
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

    const working = await fetchAndScore(now);
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

    const working = await fetchAndScore(now);
    const rel = await writeDigest(working);
    return { working, path: rel };
  } finally {
    running = false;
  }
}

/**
 * The second half alone: `npm run summary`.
 *
 * IT ONLY WRITES THE SUMMARY SIDE, and it does so unconditionally: read the
 * day's file, apply the floor to the scores as they now stand, ask for a take
 * for everything above it, write the result. No score is recomputed, no article
 * is re-fetched, and there is no branch on what state the file is in — the file
 * is whatever `npm run score` left plus whatever you edited, and that is a
 * complete input by construction.
 *
 * THE READ HAPPENS BEFORE `ensureRepo()`, which is the opposite of the ordering
 * every other path here uses and is not an oversight: the scores you edited are
 * uncommitted working-tree changes, and the sync resets the clone hard to
 * origin whenever there is nothing local to preserve. Reading first means the
 * edits are already in memory when that happens.
 *
 * Run twice, the second run changes nothing but `generatedAt`: an article that
 * already has a take is not in the summary pass's `missing` set, so nothing is
 * asked for and nothing is rewritten. That falls out of the pass itself rather
 * than from a check here.
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

    await ensureRepo();

    const withTake = working.articles.filter((a) => a.summary).length;
    console.log(
      `[daily] publish start — ${date} ` +
        `(${working.articles.length} in the file` +
        (withTake ? `, ${withTake} already with a take` : "") +
        `)`,
    );
    return await publishFrom(working, now);
  } finally {
    running = false;
  }
}
