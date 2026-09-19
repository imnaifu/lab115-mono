import { categoryOf } from "./categories";
import { archiveIndex, type SourceArticle } from "./store";
import type { PublishedArticle } from "./types";

/**
 * The few takes to put under an article: "你可能还想读".
 *
 * WHAT IT IS FOR. An article page is where almost every search and every shared
 * link lands, and until now it offered the reader exactly two ways on — off the
 * site to the original, or up to the day it ran in. So the deepest, most numerous
 * and most-arrived-at pages on this site were also its shallowest, and a reader
 * who liked one take had no way to find the next one without going back up a
 * level and starting again.
 *
 * IT IS NOT A RECOMMENDER. There is no behaviour to learn from — no reader is
 * identified and nothing is logged per reader — so this is a similarity ordering
 * over metadata the digest already carries, and it is deliberately legible:
 * every row it picks can be explained in one sentence, which is the property
 * that stops it quietly becoming filler.
 */

/**
 * The scoring, in one table so the order of preference is readable as a list
 * rather than reconstructed from an expression.
 *
 * THE ORDER IS THE SPEC: same topic first, then the same blog, then whatever ran
 * near it in time. Topic beats source because the topic is what the reader was
 * reading ABOUT — a reader who just finished a piece on labour markets wants the
 * other labour-market piece more than they want the same blog's post about
 * chips. Source is second because a blog IS a kind of subject on this site: the
 * sources were picked one at a time for having a point of view, so "more from
 * this writer" is a real recommendation rather than a coincidence of plumbing.
 *
 * TAGS ARE NOT IN THIS TABLE, and the absence is deliberate rather than an
 * oversight. `SummaryText.tags` is legacy — no longer generated, present on 35
 * of 96 archived takes, and written for a 小红书 share note rather than as a
 * subject index (see the field's own note in lib/types). Matching on it would
 * make the block behave differently on articles from a six-week window in
 * August and identically to no-tags everywhere else, which is worse than one
 * rule applied evenly.
 */
const WEIGHT = {
  /** Same category — the strongest signal, and the one the topic page is built
   *  on, so the block and `/topic/<id>` agree about what "related" means. */
  topic: 100,
  /** Same blog. */
  source: 40,
} as const;

/**
 * How far apart two articles can run and still count as contemporaneous, in
 * days, and how much the nearest one is worth.
 *
 * THE POINT IS TIE-BREAKING, NOT MATCHING. "Ran the same week" is the weakest
 * claim on the list — a daily digest puts unrelated things in one edition by
 * construction — so it is scaled to be worth less than either real signal and
 * exists to order the candidates a real signal already selected. A day-old piece
 * in the same topic should beat a month-old one, and without this they tie and
 * fall back to archive order, which is the same thing said less deliberately.
 *
 * It also decays to zero rather than cutting off: an article with no topic- or
 * source-mate in the whole archive still gets neighbours rather than an empty
 * block, they are just neighbours in time.
 */
const RECENCY_DAYS = 30;
const WEIGHT_RECENCY = 20;

/** How many rows the block shows. Four fills two columns evenly on a wide screen
 *  and reads as a short list on a phone; five leaves a hole in the grid. */
export const RELATED_COUNT = 4;

/** Whole days between two `yyyy-mm-dd` keys. Parsed as UTC so the server's
 *  timezone can never shift a digest by a day — same rule as `formatDate`. */
function daysBetween(a: string, b: string): number {
  const at = Date.parse(`${a}T00:00:00Z`);
  const bt = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(at) || Number.isNaN(bt)) return RECENCY_DAYS;
  return Math.abs(at - bt) / 86_400_000;
}

/**
 * The best few takes to show under `article`, newest-first within equal scores.
 *
 * EXCLUDES THE ARTICLE ITSELF, by id rather than by URL: the same piece can be
 * reachable at more than one address (see `readArticleBySlug`), and an id is the
 * thing that is actually one article.
 *
 * IT CAN RETURN FEWER THAN `RELATED_COUNT`, and on a young archive it returns
 * none at all. The caller renders nothing in that case rather than padding the
 * block out — a row nobody would have picked is worse than a shorter list.
 */
export async function relatedArticles(
  article: PublishedArticle,
  count = RELATED_COUNT,
): Promise<SourceArticle[]> {
  const { all } = await archiveIndex();
  // Through `categoryOf`, so an article whose stored category has been renamed
  // away is compared on the id its own page shows rather than on a dead string.
  const topic = categoryOf(article.category).id;
  // The day this article ran, which is the day the archive holds it under —
  // taken from the index rather than from `publishedAt`, since that is the
  // ORIGINAL's date and can be weeks older than the edition.
  const on = all.find((entry) => entry.article.id === article.id)?.date;

  const scored = all
    .filter((entry) => entry.article.id !== article.id)
    .map((entry) => {
      let score = 0;
      if (categoryOf(entry.article.category).id === topic) score += WEIGHT.topic;
      if (entry.article.sourceId === article.sourceId) score += WEIGHT.source;
      if (on) {
        const apart = Math.min(daysBetween(on, entry.date), RECENCY_DAYS);
        score += Math.round(WEIGHT_RECENCY * (1 - apart / RECENCY_DAYS));
      }
      return { entry, score };
    })
    /* `all` is already newest-first, and `sort` is stable — so an equal score
       keeps archive order and the newer of two equally-related pieces wins with
       no second comparison written here. */
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((row) => row.entry);
}
