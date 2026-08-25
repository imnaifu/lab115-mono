/**
 * The JSON contract committed to github.com/imnaifu/files under
 * `daily/<yyyy>/<mm>/<yyyy-mm-dd>.json`. This file is the single source of
 * truth for both the writer (jobs/daily.ts) and the reader (the pages) —
 * changing a field here means changing the published format, so keep it
 * additive once the first digest has shipped.
 */

/**
 * One language's take on an article — written to REPLACE reading it, not to
 * tease it. Hence the context and the evidence: a bare thesis tells you
 * whether to click, which is a different job.
 */
export interface SummaryText {
  /** One sentence: what the article argues. Rendered as the lead. */
  thesis: string;
  /**
   * The body, as ONE string. A blank line in it is a paragraph break; nothing
   * else in the string means anything, and there is no markdown.
   *
   * THE SHAPE OF THE FIELD DECIDES THE SHAPE OF THE WRITING, which is the
   * whole reason this is not an array. Two earlier shapes proved it. `points:
   * string[]` came back as compressed standalone sentences, so a card read
   * like a telegram — six assertions with no connective tissue. `paragraphs:
   * string[]` fixed that but replaced it with a subtler version of the same
   * fault: an array asks "how many?" before it asks "what does this say", so
   * the model filled a slot count instead of following an argument, and the
   * breaks landed where a quota ran out rather than where the reasoning
   * turned. One string asks for prose and nothing else. Where it breaks is
   * then a decision inside the writing.
   *
   * Read it with `paragraphsOf` — every renderer splits it the same way.
   */
  text: string;
  /**
   * Hashtags for the share note, WITHOUT their `#`.
   *
   * Stored bare because the marker is not part of the word and the platforms do
   * not agree about it — one string with a hash baked in would have to be
   * un-baked for anything that writes them differently. `ShareSheet` adds the
   * `#` when it composes the note.
   *
   * Optional twice over: every digest archived before this existed has none, and
   * only the Chinese half is ever written — the tags exist for 小红书, and an
   * English note carrying Chinese hashtags is worse than one carrying none. See
   * TAGS_PER_ARTICLE in lib/summarize.ts.
   */
  tags?: string[];
}

/**
 * One dimension of the score: the number the model gave it, and the one line
 * that justifies the number.
 *
 * `score` is 1-10. The model never writes a total — the weights and the sum
 * live in `SCORE_WEIGHTS` in summarize.ts, so the total is arithmetic over these
 * and can be recomputed from the stored file.
 */
export interface ScoreFinding {
  score: number;
  note: string;
}

/**
 * How the score was arrived at — one entry per dimension, in the order the
 * rubric asks for them.
 *
 * Stored because a score with no reasoning attached is not auditable, and
 * tuning the rubric is exactly the work of finding out which dimension
 * misfired. A post scoring 39 tells you nothing; the same post with
 * `accessible: 3, "WebAudio internals and Bluetooth multipoint"` tells you
 * which line to go argue with.
 *
 * IT REPLACED FOUR PROSE FINDINGS AND ONE MODEL-CHOSEN TOTAL. The old shape let
 * the model name the 0-100 number itself, and on the run of 2026-08-20 that
 * produced SIX DISTINCT VALUES across 19 articles — 85 five times, 82 six
 * times, 78 four times. A model asked for one number picks from a handful of
 * round ones; asked for six small ones it has to actually differentiate, and the
 * spread comes from the arithmetic instead.
 *
 * Written to the file for published AND rejected articles, and rendered on
 * neither — this is a record for whoever is tuning, not something a reader has
 * any use for.
 *
 * Optional: digests written before it existed carry no reviews, and an article
 * the score pass never answered for carries none either.
 */
export interface ScoreReview {
  /** What is left if you delete the writer — a position, an insight, a mechanism
   *  that travels. Merged from `opinion` + `judgment` + `transfer`, which
   *  correlated 0.73-0.88 with each other. */
  substance: ScoreFinding;
  /** Counter-intuitive, and worth repeating. Merged from `novelty` + `hook`,
   *  which correlated 0.76. */
  surprise: ScoreFinding;
  /** Readable with no background in the field. Deep-geek pieces score low. The
   *  one dimension that measured something of its own from the start. */
  accessible: ScoreFinding;
  /** Whether it sets off the reader's curiosity. */
  relevance: ScoreFinding;
  /** How well the piece is MADE — structure, evidence, whether it is padded.
   *  Independent of subject: a jargon-heavy piece can be beautifully made. */
  quality: ScoreFinding;
}

export interface Article {
  /** sha1 of the canonical URL — stable across runs, safe as a React key. */
  id: string;
  sourceId: string;
  /** A `Category.id`, assigned per article by the model. Older digests may
   *  name a category that no longer exists — `categoryOf` handles that. */
  category: string;
  /** The headline exactly as the source published it. Never translated. */
  title: string;
  /**
   * The headline REWRITTEN in Chinese, from the same pass that writes the Chinese
   * summary. Not a translation: the prompt asks for a headline someone would want
   * to open, held to the article by a no-inventing, no-overclaiming rule. `title`
   * above stays the article's name — it is what the <title>, the canonical link
   * and the second line of every card and poster show.
   *
   * Optional, and two distinct reasons for it to be absent: a digest archived
   * before this field existed has none, and the model sometimes returns the
   * original unchanged, which `chineseTitle` in summarize.ts collapses to "" so
   * no renderer prints the same string twice. A Chinese-language source is NOT
   * one of those reasons any more — it gets a rewrite like everything else.
   *
   * The English side never uses it: there the original headline IS the English.
   */
  titleZh?: string;
  url: string;
  author: string | null;
  /** ISO 8601, as published by the feed. */
  publishedAt: string;
  /** Cover image from the feed, or null → the card renders a gradient. */
  image: string | null;
  /**
   * Minutes to read THE ORIGINAL, from its body. An input, NOT a display value.
   *
   * `budgetFor` in summarize.ts sizes the summary from it — a 40-minute essay is
   * allowed more words than a link post — and `fetcher.ts` is what measures it.
   *
   * NOTHING SHOWS A PER-ARTICLE READING TIME any more. This number described the
   * original, which is a page the reader is not on; measured on the summary
   * instead it came out "1 分钟" or "2 分钟" for every article in the digest, which
   * is a column of identical numbers rather than information. The masthead still
   * totals the day — see `minutes` in DigestView — because an edition's length
   * does vary.
   */
  readingMinutes: number;
  /**
   * 5–50: five 1-10 dimensions summed. See SCORE_WEIGHTS in lib/score.ts.
   *
   * NOT 0-100. It was, back when the model named the total itself. Digests
   * archived before this change carry scores on the old scale, so the two are not
   * comparable across that date. Nothing converts them, and nothing needs to: the
   * score is never shown to a reader — it decides what publishes and in what
   * order, both of which happen within one run.
   */
  score: number;
  /**
   * The score the MODEL gave. ALWAYS WRITTEN, even when nothing overruled it.
   *
   * It is the baseline an edit is recognised against, and it has to be in the
   * published file rather than only in the half-done one: editing a score in a
   * digest that has already shipped is a supported thing to do, and without a
   * number to compare against, an edit made there is indistinguishable from the
   * model's own judgement forever after.
   *
   * It was briefly written only when it DIFFERED from `score`, on the argument
   * that "nobody touched this" should not cost a field. What that actually cost
   * was the ability to tell "nobody touched this" from "someone edited a file
   * that had no baseline in it" — which is the one case the field exists for.
   *
   * Optional in the type because digests archived before it existed have none.
   */
  modelScore?: number;
  /**
   * "human" when `score` was hand-edited, absent otherwise.
   *
   * Derivable from `modelScore !== score` and written anyway: one obvious string
   * beats every reader of the archive having to know the comparison.
   */
  scoredBy?: "human";
  /**
   * 1-based position after sorting by score — among the articles that were
   * PUBLISHED. 0 on the ones that were not: they have no position, and giving
   * them one would make `rank` two different measures in one field.
   */
  rank: number;
  /** How the score was arrived at. See ScoreReview. */
  review?: ScoreReview;
  /**
   * The take, in each language it was written in — AND THE ONE FIELD THAT SAYS
   * WHETHER THIS ARTICLE IS PUBLISHED.
   *
   * Absent means considered and not published: it scored below the floor, or it
   * cleared the floor and its summary never came back. Those entries are in
   * `articles` alongside the published ones because ONE LIST is the whole
   * shape of this file now — see `Digest.rejected` for the two-list version
   * this replaced — and nothing renders them. Read the list through
   * `shownArticles` in lib/store.ts, which is where that rule lives.
   *
   * `zh` is the spine: an article with a take always has the Chinese one. `en`
   * is OPTIONAL, and its absence has two ordinary causes rather than one
   * exceptional one: a digest archived while the site was Chinese-only carries
   * no `en` at all, and a run where the model returned the Chinese half and
   * stopped publishes that article with `zh` alone rather than holding up the
   * day for it.
   *
   * So every renderer reads this through `summaryFor` in lib/take.ts, which falls
   * back to `zh`. That fallback is the one place the site still shows Chinese to a
   * reader who asked for English, and it is deliberate: an archive page with no
   * body is worse than one in the wrong language.
   */
  summary?: { zh: SummaryText; en?: SummaryText };
}

/**
 * An article that HAS a take, which is the only kind anything renders.
 *
 * The narrowing exists so the rule "no summary means it was not published" is
 * enforced by the compiler rather than remembered: renderers take this type,
 * and the one function that produces it is `shownArticles` in lib/store.ts. A
 * component reaching into `digest.articles` directly does not typecheck.
 */
export type PublishedArticle = Article & {
  summary: NonNullable<Article["summary"]>;
};

/**
 * Fetched and summarized, but not given a card — rendered as a plain title
 * link. Carries its score so it is possible to tell WHY it was folded: a low
 * one means the model judged it thin, a high one means its section or its
 * source was already full.
 */
export interface FoldedArticle {
  title: string;
  url: string;
  sourceId: string;
  score: number;
}

/**
 * Below the publish floor and therefore never summarized — a record of what
 * was considered and turned down, NOT something the page renders.
 *
 * Includes articles the score pass never spoke for: their score is 0, 0 is
 * below the floor, and they are turned down like any other. A run whose model
 * calls failed therefore shows up here as a pile of zeroes.
 *
 * Deliberately not `folded`: that list appears on the page as 其他动态, and the
 * whole point of this one is that it does not. It exists so a run can be
 * audited after the fact — "why is that post missing" is answerable, and a
 * rubric that starts rejecting good work is visible in the file before it is
 * visible in the digest.
 *
 * Optional because digests written before it existed do not carry it.
 */
export interface RejectedArticle {
  title: string;
  url: string;
  sourceId: string;
  score: number;
  /** Why it was turned down, in the model's own words. The whole point of
   *  keeping a rejection list is answering "why is that post missing", and the
   *  score alone never answered it. */
  review?: ScoreReview;
  /** Same meaning as on `Article`, and it belongs here for the same reason the
   *  review does: an article a human pushed BELOW the floor is a decision, and
   *  a rejection list that cannot tell it apart from a model rejection is the
   *  list failing at its one job. */
  modelScore?: number;
  scoredBy?: "human";
}

/**
 * Per-source outcome for the run. A source that threw still gets an entry with
 * `ok: false` so the page can say "this one failed today" instead of silently
 * pretending the site published nothing.
 */
export interface SourceStatus {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface Digest {
  /** yyyy-mm-dd in DAILY_TZ — also the filename. */
  date: string;
  generatedAt: string;
  /** The publication window actually scanned, both ISO 8601 UTC. */
  window: { from: string; to: string };
  stats: { fetched: number; shown: number; folded: number };
  sources: SourceStatus[];
  /**
   * EVERY article the window held, published or not — one list.
   *
   * `summary` is what separates them: an entry with a take is on the page, an
   * entry without one is the record that it was considered and turned down.
   * `shownArticles` in lib/store.ts is the only place that rule is applied.
   *
   * It used to be two lists, `articles` and `rejected` below, and the split
   * cost more than it bought. A rejection carried four fields, so acting on one
   * later — raising a score by hand and publishing it — meant reconstructing an
   * article from a title and a url. And the two lists had to be kept in step by
   * whoever wrote them: the first version of the merge computed `rejected` as
   * the complement of the published set and silently dropped articles that were
   * over the floor with no summary, which appeared in neither.
   */
  articles: Article[];
  folded: FoldedArticle[];
  /**
   * LEGACY, and no longer written. Digests archived before the lists were
   * merged carry their turned-down articles here; nothing renders them, and
   * `RejectedArticle` exists so those files still parse.
   */
  rejected?: RejectedArticle[];
}
