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
 *
 * `background` and `implication` are optional because digests archived before
 * this shape existed have neither, and an old page must still render.
 */
export interface SummaryText {
  /** One sentence: what the article argues. Rendered as the lead. */
  thesis: string;
  /**
   * 2–4 flowing paragraphs carrying the context, the evidence and what
   * follows from it.
   *
   * Prose, not bullets. An earlier version modelled this as an array of
   * points, and the shape of the field decided the shape of the writing: each
   * entry came back as a compressed standalone sentence, so a card read like
   * a telegram — six assertions with no connective tissue between them. A
   * paragraph forces the model to relate its facts to each other, which is the
   * part that makes a summary readable instead of merely complete.
   */
  paragraphs?: string[];

  // --- superseded, kept so archived digests still render ---
  /** @deprecated folded into `paragraphs`. */
  background?: string;
  /** @deprecated folded into `paragraphs`. */
  points?: string[];
  /** @deprecated folded into `paragraphs`. */
  implication?: string;
}

/**
 * What the score pass wrote before it committed to a number — one finding per
 * test, in the order the rubric asks for them.
 *
 * Stored because a score with no reasoning attached is not auditable, and
 * tuning the rubric is exactly the work of finding out which test misfired. A
 * post scoring 15 tells you nothing; the same post with "relays a personal
 * anecdote, nothing transfers" tells you which line to go argue with.
 *
 * Written to the file for published AND rejected articles, and rendered on
 * neither — this is a record for whoever is tuning, not something a reader has
 * any use for.
 *
 * Optional: digests written before it existed carry no reviews, and an article
 * the score pass never answered for carries none either.
 */
export interface ScoreReview {
  /** Argument or announcement. */
  argument: string;
  /** What a non-specialist takes away, and whether it transfers. */
  transfer: string;
  /** A claim, or a list. */
  claim: string;
  /** The bonus, and what earned it. */
  appeal: string;
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
   * The headline in Chinese, from the same pass that writes the Chinese summary.
   *
   * Optional, and two distinct reasons for it to be absent: a digest archived
   * before this field existed has none, and an article whose headline is already
   * Chinese gets none either — 阮一峰's posts are their own translation, and a
   * second copy of the same string is not a second line worth rendering.
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
  /** 0–100 information density, assigned by the model. */
  score: number;
  /** 1-based position after sorting by score. */
  rank: number;
  /** How the score was arrived at. See ScoreReview. */
  review?: ScoreReview;
  summary: { zh: SummaryText; en: SummaryText };
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
