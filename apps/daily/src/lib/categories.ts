import { USER_CONFIG } from "./user-config";

/**
 * The sections of a digest, defined in `config.json`.
 *
 * That file drives everything downstream: the model's enum, the classification
 * instructions in the prompt, the page's running order and each section's card
 * limit. Adding a category means adding one entry there and nothing else.
 *
 * Categories are assigned per ARTICLE, not per source. Hacker News and Marginal
 * Revolution each span everything from database internals to labour economics,
 * so a static source→category map would misfile a large share of the day.
 */
export interface Category {
  id: string;
  /** Section heading. */
  name: string;
  /** Smaller English line under it. */
  nameEn: string;
  accent: string;
  /**
   * Handed to the model verbatim. Write it as a boundary, not a topic list —
   * the hard part is not "what is AI" but "what goes here rather than next
   * door". The catch-all in particular has to yield explicitly, or it quietly
   * swallows its neighbours.
   */
  hint: string;
}

export const CATEGORIES: Category[] = USER_CONFIG.categories;

/** Where an unrecognised or missing classification lands. */
export const FALLBACK_CATEGORY = USER_CONFIG.fallbackCategory;

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Never throws — an archived digest may name a category that has since been
 *  renamed away, and an old page must still render. */
export function categoryOf(id: string): Category {
  return (
    CATEGORY_BY_ID.get(id) ??
    CATEGORY_BY_ID.get(FALLBACK_CATEGORY) ??
    CATEGORIES[0]
  );
}

/** Normalizes whatever the model returned to a known id. */
export function resolveCategory(value: unknown): string {
  const id = String(value ?? "")
    .trim()
    .toLowerCase();
  return CATEGORY_BY_ID.has(id) ? id : FALLBACK_CATEGORY;
}

/**
 * The only score threshold: below it an article does not reach the page at all.
 *
 * There used to be two, a ladder — one admitted an article to the page, the
 * other promoted it to a full card, and everything in between rendered as a
 * one-line row. Now that every published article gets a card, "worth a card"
 * and "worth publishing" are the same question, so there is one floor and it
 * keeps the card floor's value (40) rather than the lower publish floor's:
 * what did not deserve a card should not now get one by default.
 *
 * A card has to be earned. Without a floor a 30-point links roundup
 * ("Wednesday assorted links") or a version bump (`Grok 4.6`, scored 25) takes
 * a cover and a 300-character summary simply for having been fetched. The
 * scorer is right about those; this is the place that acts on it.
 *
 * Applied in the daily job rather than in the components, so an archived digest
 * is never re-filtered by a floor that did not exist when it was written.
 *
 * The floor only judges articles the model actually judged — see the thesis
 * check at its call site in jobs/daily.ts.
 */
export const PUBLISH_MIN_SCORE = USER_CONFIG.publishMinScore;
