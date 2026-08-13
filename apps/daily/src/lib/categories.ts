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
  /**
   * How many of this section's articles get a full card. Everything below
   * that rank still appears, as a one-line row — nothing is dropped.
   */
  cardCount: number;
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
 * A card has to be earned, not merely ranked into.
 *
 * Every article is published now, so this no longer decides what is *seen* —
 * only what gets the space of a full card. Without it a 30-point links
 * roundup ("Wednesday assorted links") took a card simply by being the only
 * thing in its section that day. Below the floor an article still appears, as
 * a one-line row.
 */
export const MIN_SCORE = USER_CONFIG.minScore;
