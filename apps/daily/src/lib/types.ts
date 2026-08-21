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
  readingMinutes: number;
  /**
   * 5–50: five 1-10 dimensions summed. See SCORE_WEIGHTS in lib/score.ts.
   *
   * NOT 0-100. It was, back when the model named the total itself. Digests
   * archived before this change carry scores on the old scale, so the two are
   * not comparable across that date — and `starCount` will rate all of them five
   * stars, which is the honest consequence of not converting them.
   */
  score: number;
  /** 1-based position after sorting by score. */
  rank: number;
  /** How the score was arrived at. See ScoreReview. */
  review?: ScoreReview;
  /** CHINESE ONLY. There was an `en` half here and it is gone; the pages still
   *  route under /zh and /en, but both render this. */
  summary: { zh: SummaryText };
}

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
  articles: Article[];
  folded: FoldedArticle[];
  /** Below the floor: written to the file, never rendered. */
  rejected?: RejectedArticle[];
}
