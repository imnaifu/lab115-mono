import { PUBLISH_MIN_SCORE } from "@/lib/categories";
import type { RawArticle } from "@/lib/fetcher";
import { commitAndPush, ensureRepo } from "@/lib/repo";
import { sourceOf } from "@/lib/sources";
import { listDates, readDigest, relPathFor, writeDigest } from "@/lib/store";
import { repairTakes, verdictsFrom } from "@/lib/summarize";
import { isCompleteTake } from "@/lib/take";
import type { Article, Digest } from "@/lib/types";

/**
 * Repairing half-written takes in digests that already shipped.
 *
 * A take is the Chinese AND the English. The summary pass takes each half on its
 * own, so a reply can be valid, parse cleanly, and still leave an article with
 * one half — and until pass 3 existed there was nothing to catch that after the
 * fact. Pass 3 catches it during a run; this catches what is already on disk.
 *
 * IT REPLACED `backfill-en`, which wrote the English half by TRANSLATING the
 * Chinese one. Three reasons it is gone. It could only fix one of the three ways
 * a take breaks — a missing Chinese half, or a missing both, was outside it. It
 * was the only path in the codebase that wrote one half from the other instead
 * of from the article, so a take it had touched was a different kind of object
 * from one the summary pass wrote, and nothing in the file said which was which.
 * And it needed a fourth prompt to do it. This asks the summary prompt again,
 * which is one path and one prompt for "this take is not right, do it over".
 *
 * WHAT THAT COSTS, stated because it is a real regression and not a wash: the
 * translation never needed the article, and this does. A published digest carries
 * no bodies (see `WorkingArticle` in lib/store.ts), so every repair here re-fetches
 * the original — and a link that has died or a paywall that has closed since is now
 * a repair that cannot happen, where a translation would have gone through.
 * `summarizeGroup` sends the request anyway with no body and says so in the prompt;
 * what comes back is a headline-grade take, and it will still be written if it is
 * complete. If that matters for a given day, re-score it instead.
 *
 * WHAT IT WILL NOT TOUCH: the score, the review, `modelScore`, `scoredBy`, the
 * order of the list, or any article whose take is already whole. It DOES rewrite
 * `category` and `titleZh` alongside the summary, because those come out of the
 * same reply — see `writeBack` for why taking the summary and leaving them would
 * be the worse choice. And it renumbers `rank` and recomputes `stats.shown`,
 * because an article that gains a take gains a place on the page, and a file that
 * says otherwise is a file that disagrees with what the site renders.
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
  /** Days that gained at least one whole take. */
  changed: string[];
  /** Articles that were incomplete and now are not. */
  repaired: number;
  /** Articles that were incomplete and still are — the re-ask did not land. */
  missed: number;
  /** Articles already whole. Nothing was sent for these. */
  already: number;
}

/**
 * Whether the article was ever supposed to have a take.
 *
 * THE SAME TEST THE RUN APPLIED, and it has to be recomputed rather than read
 * off the file: an article below the floor carries no summary BY DESIGN, and a
 * backfill that treated "no summary" as "broken" would re-summarize every
 * article the day deliberately turned down — which is most of them, at model
 * cost, to publish work the floor rejected.
 *
 * `alwaysPublish` is checked first for the same reason it is in jobs/daily.ts:
 * a whitelisted source goes on the page whatever it scored.
 */
function clearedFloor(article: Article): boolean {
  return (
    sourceOf(article.sourceId).alwaysPublish || article.score >= PUBLISH_MIN_SCORE
  );
}

/**
 * The digest with the repaired takes in it, rebuilt rather than mutated.
 *
 * WRITTEN ONLY WHERE THE VERDICT CAME BACK WHOLE. A re-ask that returned one
 * half again leaves that article exactly as it was — the archive is published
 * work, and a pass that can half-rewrite it is a pass that can make a shipped
 * day worse than it was. `repairTakes` asks with `clear: false` for the same
 * reason, so the two agree: this can improve an article or leave it alone.
 *
 * CATEGORY AND TITLE GO WITH THE SUMMARY. They are fields of the same reply, and
 * writing the take while keeping the old ones would leave an article whose
 * Chinese headline was written for a summary that no longer exists. That is the
 * drift this whole file is here to remove, in miniature.
 *
 * RANK IS RENUMBERED AND `stats.shown` RECOMPUTED, over the published set as it
 * stands after the repair. `rank` is 1-based position among published articles
 * and 0 on the rest — an article that just gained its take has been sitting at 0,
 * and the ones below it are all off by one. Neither field is read by any
 * renderer, which is exactly why they have to be right here: nothing downstream
 * would ever reveal that they are not.
 */
function writeBack(
  digest: Digest,
  repaired: Map<string, Article["summary"]>,
  meta: Map<string, { category: string; titleZh: string }>,
): Digest {
  const articles = digest.articles.map((article) => {
    const summary = repaired.get(article.id);
    if (!summary) return article;
    const fields = meta.get(article.id)!;
    return {
      ...article,
      category: fields.category,
      // Omitted rather than stored empty, on the same rule as the run: an absent
      // field means "there is no Chinese headline to show".
      ...(fields.titleZh ? { titleZh: fields.titleZh } : { titleZh: undefined }),
      summary,
    };
  });

  let position = 0;
  const renumbered = articles.map((article) => ({
    ...article,
    rank: isCompleteTake(article.summary) ? (position += 1) : 0,
  }));

  return {
    ...digest,
    stats: { ...digest.stats, shown: position },
    articles: renumbered,
  };
}

/**
 * One pass over the archive.
 *
 * DAY BY DAY, writing and committing each before starting the next, rather than
 * gathering everything and writing once at the end. An archive of any size means
 * a long run, and a long run gets interrupted — Ctrl-C, a rate limit, a laptop
 * lid. Committing per day means an interrupted backfill has done real, complete
 * work up to where it stopped, and re-running it picks up from there: articles
 * whose take is already whole are skipped without a request.
 */
export async function backfillSummaries(
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  await ensureRepo();

  const dates = options.dates?.length
    ? [...options.dates].sort().reverse()
    : await listDates();

  const result: BackfillResult = {
    changed: [],
    repaired: 0,
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

    const eligible = digest.articles.filter(clearedFloor);
    const broken = eligible.filter((a) => !isCompleteTake(a.summary));
    result.already += eligible.length - broken.length;
    if (!broken.length) {
      console.log(`[daily] backfill — ${date} already whole`);
      continue;
    }

    // The cap applies to articles, not days: a day is not an indivisible unit of
    // work here, because each article is its own request.
    const take = broken.slice(0, budget);
    budget -= take.length;
    console.log(
      `[daily] backfill — ${date}: ${take.length} of ${broken.length} ` +
        `incomplete take(s)` +
        (take.length < broken.length ? " (limited)" : ""),
    );

    /**
     * `body: ""` ON PURPOSE. A published digest carries none, and
     * `summarizeGroup` is what goes and gets it — the same line that serves a
     * re-run of an already-shipped day in the summary pass. Fetching here too
     * would be a second copy of that policy.
     */
    const sending: RawArticle[] = take.map((article) => ({
      id: article.id,
      sourceId: article.sourceId,
      title: article.title,
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt,
      image: article.image,
      readingMinutes: article.readingMinutes,
      body: "",
    }));

    /**
     * SEEDED WITH WHAT IS ALREADY THERE, which is what makes a partial reply
     * additive: an article missing only its English half goes in carrying its
     * Chinese, so a reply that returns the English alone comes out whole. An
     * empty map would make every such reply look like a fresh half.
     */
    const verdicts = verdictsFrom(
      take.map((article) => ({ ...article, judged: true })),
    );
    await repairTakes(sending, verdicts, eligible.length);

    const repaired = new Map<string, Article["summary"]>();
    const meta = new Map<string, { category: string; titleZh: string }>();
    for (const article of take) {
      const verdict = verdicts.get(article.id)!;
      if (!isCompleteTake(verdict)) continue;
      repaired.set(article.id, { zh: verdict.zh, en: verdict.en! });
      meta.set(article.id, {
        category: verdict.category,
        titleZh: verdict.titleZh,
      });
    }

    result.repaired += repaired.size;
    result.missed += take.length - repaired.size;
    if (!repaired.size) continue;

    const rel = await writeDigest(writeBack(digest, repaired, meta));
    // Named for what it is. A commit reading "daily: <date>" would be
    // indistinguishable in the log from the run that generated the day.
    await commitAndPush(
      [rel],
      `daily: ${date} — repaired ${repaired.size} take(s)`,
    );
    result.changed.push(date);
    console.log(`[daily] backfill — ${date} written (${relPathFor(date)})`);
  }

  console.log(
    `[daily] backfill done — ${result.repaired} repaired, ` +
      `${result.missed} still incomplete, ${result.already} already whole, ` +
      `${result.changed.length} day(s) changed`,
  );
  return result;
}
