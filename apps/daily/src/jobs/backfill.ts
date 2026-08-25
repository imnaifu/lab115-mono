import { englishFor, type EnglishRequest } from "@/lib/summarize";
import { commitAndPush, ensureRepo } from "@/lib/repo";
import {
  listDates,
  readDigest,
  relPathFor,
  shownArticles,
  writeDigest,
} from "@/lib/store";
import { cachePosters } from "@/jobs/posters";
import type { Digest } from "@/lib/types";

/**
 * Writing the English half into digests that shipped without one.
 *
 * The site rendered Chinese only for a while, so every archived digest carries
 * `summary.zh` alone and `/en` falls back to it (see `summaryFor` in lib/take.ts).
 * The fallback is honest but it is not the English site: this closes the archive's
 * half of that, one day at a time.
 *
 * IT IS THE CHEAPEST NOW IT WILL EVER BE. The work is one model call per article
 * with no English, so its cost is the size of the archive — which grows by a
 * day every day. There is no deadline on running it and no reason to wait.
 *
 * WHAT IT WILL NOT DO: touch anything but `summary.en`. Not the score, not the
 * category, not the Chinese, not the order, not the rewritten headline. A digest
 * is the record of a day's editorial decisions and this is not re-deciding them —
 * `runDaily` regenerates a day, and that is a different command with a different
 * name for a reason.
 */

export interface BackfillOptions {
  /** Which days. Absent means every archived day. */
  dates?: string[];
  /**
   * Stop after this many articles, across all days.
   *
   * For the first run of a paid operation on an archive of unknown size: the
   * count is printed before anything is sent, but a cap is what makes a careful
   * first pass possible without editing anything.
   */
  limit?: number;
}

export interface BackfillResult {
  /** Days that gained at least one English take. */
  changed: string[];
  /** Articles that had none and now do. */
  written: number;
  /** Articles that had none and still do not — the model never answered. */
  missed: number;
  /** Articles skipped because they already had one. Nothing was sent for these. */
  already: number;
}

/**
 * One pass over the archive.
 *
 * DAY BY DAY, writing and committing each before starting the next, rather than
 * gathering everything and writing once at the end. An archive of any size means
 * a long run, and a long run gets interrupted — Ctrl-C, a rate limit, a laptop
 * lid. Committing per day means an interrupted backfill has done real, complete
 * work up to where it stopped, and re-running it picks up from there: articles
 * that already have an English take are skipped without a request.
 */
export async function backfillEnglish(
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  await ensureRepo();

  const dates = options.dates?.length
    ? [...options.dates].sort().reverse()
    : await listDates();

  const result: BackfillResult = {
    changed: [],
    written: 0,
    missed: 0,
    already: 0,
  };
  let budget = options.limit ?? Infinity;

  for (const date of dates) {
    if (budget <= 0) {
      console.log(`[daily] backfill — limit reached, stopping before ${date}`);
      break;
    }

    const digest = await readDigest(date);
    if (!digest) {
      console.warn(`[daily] backfill — ${date} has no digest, skipping`);
      continue;
    }

    // `shownArticles`: the list also holds what was considered and turned down,
    // and an article with no Chinese take is not one that is missing English.
    const shown = shownArticles(digest);
    const missing = shown.filter((a) => !a.summary.en);
    result.already += shown.length - missing.length;
    if (!missing.length) {
      console.log(`[daily] backfill — ${date} already complete`);
      continue;
    }

    // The cap applies to articles, not days: a day is not an indivisible unit of
    // work here, because each article is its own request and its own write.
    const take = missing.slice(0, budget);
    budget -= take.length;
    console.log(
      `[daily] backfill — ${date}: ${take.length} of ${missing.length} ` +
        `article(s) without English` +
        (take.length < missing.length ? " (limited)" : ""),
    );

    const requests: EnglishRequest[] = take.map((article) => ({
      id: article.id,
      title: article.title,
      zh: article.summary.zh,
    }));
    const english = await englishFor(requests);
    result.written += english.size;
    result.missed += take.length - english.size;
    if (!english.size) continue;

    /**
     * Rebuilt rather than mutated in place, so nothing else in the file can
     * change by accident: every other field is carried across by reference and
     * only `summary` is a new object.
     */
    const updated: Digest = {
      ...digest,
      articles: digest.articles.map((article) => {
        const en = article.summary ? english.get(article.id) : undefined;
        return en && article.summary
          ? { ...article, summary: { ...article.summary, en } }
          : article;
      }),
    };

    const rel = await writeDigest(updated);
    // Named for what it is. A commit reading "daily: <date>" would be
    // indistinguishable in the log from the run that generated the day.
    await commitAndPush(
      [rel],
      `daily: ${date} — English for ${english.size} article(s)`,
    );
    result.changed.push(date);

    /**
     * The English posters for exactly the articles that changed.
     *
     * REQUIRED, not an optimisation. The poster cache is keyed date + article +
     * language + part and is consulted before anything is rendered, so the
     * `/en/…/share.png` files sitting there — drawn from the Chinese, back when
     * that was all there was — would be served forever, and the English page
     * would share a Chinese image.
     *
     * The Chinese ones are left alone: nothing this job wrote can change them.
     * Part COUNTS change though, and only upward in practice — the same take is
     * wider in English — so the extra parts are new files rather than replacements.
     */
    await cachePosters(updated, { ids: new Set(english.keys()), langs: ["en"] });
    console.log(`[daily] backfill — ${date} written (${relPathFor(date)})`);
  }

  console.log(
    `[daily] backfill done — ${result.written} written, ` +
      `${result.missed} still without English, ${result.already} already had one, ` +
      `${result.changed.length} day(s) changed`,
  );
  return result;
}
