import { dateKey } from "@/lib/config";
import {
  CATEGORIES,
  FALLBACK_CATEGORY,
  PUBLISH_MIN_SCORE,
} from "@/lib/categories";
import { fetchAll } from "@/lib/fetcher";
import { notify } from "@/lib/notify";
import { commitAndPush, ensureRepo } from "@/lib/repo";
import { readDigest, writeDigest } from "@/lib/store";
import { summarize } from "@/lib/summarize";
import type { Article, Digest, FoldedArticle } from "@/lib/types";

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
 * One full run: pull → fetch → summarize → rank → write JSON → push → notify.
 *
 * The digest is written and pushed even when nothing was found, so every date
 * has a file and the site can render an honest "今日无更新" instead of silently
 * showing yesterday.
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

    const { articles: raw, statuses, window } = await fetchAll(now);
    console.log(
      `[daily] fetched ${raw.length} article(s) from ` +
        `${statuses.filter((s) => s.ok).length}/${statuses.length} source(s)`,
    );

    const verdicts = await summarize(raw);

    // Rank purely by the model's information-density score; ties fall back to
    // recency so the ordering is deterministic.
    const sorted = [...raw].sort((a, b) => {
      const diff =
        (verdicts.get(b.id)?.score ?? 0) - (verdicts.get(a.id)?.score ?? 0);
      return diff !== 0 ? diff : b.publishedAt.localeCompare(a.publishedAt);
    });

    /**
     * The publish floor, applied to what the model actually judged.
     *
     * An empty thesis means the summarizer never spoke for this article — a
     * failed call, not a verdict of "worthless" — and its score is 0 only
     * because that is what emptyVerdict() carries. Filtering on the score alone
     * would turn a total model outage into an empty digest, which is the one
     * failure mode this job is built to avoid: unjudged articles keep their
     * place and render as bare titles, exactly as before the floor existed.
     */
    const ranked = sorted.filter((item) => {
      const verdict = verdicts.get(item.id);
      if (!verdict?.zh.thesis) return true;
      return verdict.score >= PUBLISH_MIN_SCORE;
    });

    if (ranked.length !== sorted.length) {
      console.log(
        `[daily] dropped ${sorted.length - ranked.length} article(s) below ` +
          `the publish floor (${PUBLISH_MIN_SCORE}): ` +
          sorted
            .filter((item) => !ranked.includes(item))
            .map((item) => `${verdicts.get(item.id)?.score} ${item.title}`)
            .join(" · "),
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

    const articles: Article[] = ranked.map((item, i) => {
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
        rank: i + 1,
        summary: { zh: verdict.zh, en: verdict.en },
      };
    });

    // Kept in the contract, always empty from here on: archived digests still
    // carry entries and the page still renders them.
    const folded: FoldedArticle[] = [];

    const digest: Digest = {
      date,
      generatedAt: now.toISOString(),
      window: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
      },
      stats: {
        fetched: raw.length,
        shown: articles.length,
        folded: folded.length,
      },
      sources: statuses,
      articles,
      folded,
    };

    const rel = await writeDigest(digest);
    await commitAndPush(
      [rel],
      `daily: ${date} — ${digest.stats.fetched} article(s)`,
    );
    await notify(digest);

    console.log(
      `[daily] run done — ${digest.stats.shown} shown, ` +
        `${digest.stats.folded} folded`,
    );
    return digest;
  } finally {
    running = false;
  }
}
