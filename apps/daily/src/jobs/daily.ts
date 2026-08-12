import { TOP_N, dateKey } from "@/lib/config";
import { fetchAll } from "@/lib/fetcher";
import { notify } from "@/lib/notify";
import { commitAndPush, ensureRepo } from "@/lib/repo";
import { writeDigest } from "@/lib/store";
import { summarize } from "@/lib/summarize";
import type { Article, Digest, FoldedArticle } from "@/lib/types";

/** Guards against a manual `once` overlapping the cron tick. */
let running = false;

/**
 * One full run: pull → fetch → summarize → rank → write JSON → push → notify.
 *
 * The digest is written and pushed even when nothing was found, so every date
 * has a file and the site can render an honest "今日无更新" instead of silently
 * showing yesterday.
 */
export async function runDaily(now = new Date()): Promise<Digest> {
  if (running) throw new Error("a run is already in progress");
  running = true;

  try {
    const date = dateKey(now);
    console.log(`[daily] run start — ${date}`);

    await ensureRepo();

    const { articles: raw, statuses, window } = await fetchAll(now);
    console.log(
      `[daily] fetched ${raw.length} article(s) from ` +
        `${statuses.filter((s) => s.ok).length}/${statuses.length} source(s)`,
    );

    const verdicts = await summarize(raw);

    // Rank purely by the model's information-density score; ties fall back to
    // recency so the ordering is deterministic.
    const ranked = [...raw].sort((a, b) => {
      const diff =
        (verdicts.get(b.id)?.score ?? 0) - (verdicts.get(a.id)?.score ?? 0);
      return diff !== 0 ? diff : b.publishedAt.localeCompare(a.publishedAt);
    });

    const articles: Article[] = ranked.slice(0, TOP_N).map((item, i) => {
      const verdict = verdicts.get(item.id)!;
      return {
        id: item.id,
        sourceId: item.sourceId,
        title: item.title,
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

    const folded: FoldedArticle[] = ranked.slice(TOP_N).map((item) => ({
      title: item.title,
      url: item.url,
      sourceId: item.sourceId,
    }));

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
