/**
 * The JSON contract committed to github.com/imnaifu/files under
 * `daily/<yyyy>/<mm>/<yyyy-mm-dd>.json`. This file is the single source of
 * truth for both the writer (jobs/daily.ts) and the reader (the pages) —
 * changing a field here means changing the published format, so keep it
 * additive once the first digest has shipped.
 */

/** One language's take on an article. */
export interface SummaryText {
  /** One sentence: what the article actually argues. */
  thesis: string;
  /** 2–3 supporting points. */
  points: string[];
}

export interface Article {
  /** sha1 of the canonical URL — stable across runs, safe as a React key. */
  id: string;
  sourceId: string;
  /** A `Category.id`, assigned per article by the model. Older digests may
   *  name a category that no longer exists — `categoryOf` handles that. */
  category: string;
  title: string;
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
}
