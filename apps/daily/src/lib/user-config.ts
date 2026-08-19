import file from "../../config.json";

/**
 * The hand-edited half of this app: which blogs to read and which sections to
 * file them under. Lives in `config.json` at the app root so it can be changed
 * without touching TypeScript.
 *
 * Distinct from `config.ts`, which holds the machine-set knobs (env vars,
 * schedules, credentials). Rule of thumb: if changing it is an editorial
 * decision, it belongs in config.json; if it is an operational one, it belongs
 * in an env var.
 *
 * The file is imported, not read at runtime — it is baked into the image, so
 * a change takes a push and a redeploy. Everything below fails loudly at load
 * rather than quietly dropping a malformed entry: a source that silently
 * vanished would look exactly like a blog that stopped publishing.
 */

export interface RawScrape {
  index: string;
  /** Source text of a regex with named groups url / date / title. */
  pattern: string;
  flags: string;
}

export interface RawSource {
  id: string;
  name: string;
  site: string;
  feed: string;
  /** A `Category.id`. Editorial metadata describing what this SOURCE mostly
   *  publishes — NOT what any article gets filed under, which the model decides
   *  per article. Kept so the source list can be reviewed by section. */
  category: string;
  /** One line on what this source publishes and what is wrong with it, written
   *  from its recent output rather than its reputation. Exists to make "should
   *  this be dropped" answerable without opening the site. */
  description: string;
  accent: string;
  /**
   * True exempts every article from this source from the publish floor: it is
   * summarized and published whatever it scores.
   *
   * For the source you keep BECAUSE it is that person writing, not because each
   * post clears a bar. 硅谷居士 is the case it was added for — short personal
   * posts about his own investing that the rubric reads, correctly, as
   * anecdote-without-argument and caps in the 20s. The rubric is not wrong; it
   * is answering a different question than "do I want to see this".
   *
   * It is a real exemption and it exempts the bad days too. A whitelisted
   * source that posts a link roundup publishes that link roundup.
   */
  alwaysPublish?: boolean;
  /** False parks a source without deleting it: it is not fetched, but it stays
   *  in SOURCES so archived digests carrying its articles still render with its
   *  name, link and accent instead of falling back to a bare id. Absent counts
   *  as enabled. */
  enabled?: boolean;
  fetchBody: boolean;
  maxPerRun?: number;
  scrape?: RawScrape;
}

export interface RawCategory {
  id: string;
  name: string;
  nameEn: string;
  accent: string;
  hint: string;
}

interface RawConfig {
  /** The only score threshold: below it an article is not published at all.
   *  See PUBLISH_MIN_SCORE in categories.ts. */
  publishMinScore: number;
  /** Bounds for one article's Chinese summary, in characters. */
  summaryMinChars: number;
  summaryMaxChars: number;
  /** Ceiling on ONE paragraph. Deliberately not derived from summaryMaxChars —
   *  see PARA_MAX in summarize.ts for why the two move independently. */
  summaryParaMaxChars: number;
  categories: RawCategory[];
  fallbackCategory: string;
  sources: RawSource[];
}

const raw = file as unknown as RawConfig;

function fail(message: string): never {
  throw new Error(`config.json: ${message}`);
}

function requireFields(
  entry: Record<string, unknown>,
  fields: string[],
  where: string,
): void {
  for (const field of fields) {
    const value = entry[field];
    if (value === undefined || value === null || value === "") {
      fail(`${where} is missing "${field}"`);
    }
  }
}

function requireUniqueIds(entries: Array<{ id: string }>, where: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) fail(`duplicate ${where} id "${entry.id}"`);
    seen.add(entry.id);
  }
}

function validate(config: RawConfig): RawConfig {
  if (
    !Number.isFinite(config.publishMinScore) ||
    config.publishMinScore < 0 ||
    config.publishMinScore > 100
  ) {
    fail("publishMinScore must be a number between 0 and 100");
  }
  if (
    !Number.isFinite(config.summaryMinChars) ||
    !Number.isFinite(config.summaryMaxChars) ||
    config.summaryMinChars < 20 ||
    config.summaryMaxChars <= config.summaryMinChars
  ) {
    fail(
      "summaryMinChars/summaryMaxChars must be numbers with min >= 20 and " +
        "max greater than min",
    );
  }
  // A paragraph ceiling at or above the whole-summary ceiling constrains
  // nothing, and the per-paragraph budget is the one the model actually obeys.
  if (
    !Number.isFinite(config.summaryParaMaxChars) ||
    config.summaryParaMaxChars < 20 ||
    config.summaryParaMaxChars >= config.summaryMaxChars
  ) {
    fail(
      `summaryParaMaxChars must be a number of at least 20 and below ` +
        `summaryMaxChars (${config.summaryMaxChars}) — at or above it the ` +
        `per-paragraph budget stops constraining anything`,
    );
  }
  if (!Array.isArray(config.categories) || config.categories.length === 0) {
    fail("categories must be a non-empty array");
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    fail("sources must be a non-empty array");
  }

  for (const category of config.categories) {
    requireFields(
      category as unknown as Record<string, unknown>,
      ["id", "name", "nameEn", "accent", "hint"],
      `category "${category.id ?? "?"}"`,
    );
  }
  requireUniqueIds(config.categories, "category");

  if (!config.categories.some((c) => c.id === config.fallbackCategory)) {
    fail(
      `fallbackCategory "${config.fallbackCategory}" is not one of the ` +
        `categories — an unclassified article would have nowhere to go`,
    );
  }

  const categoryIds = new Set(config.categories.map((c) => c.id));
  for (const source of config.sources) {
    requireFields(
      source as unknown as Record<string, unknown>,
      ["id", "name", "site", "accent", "category", "description"],
      `source "${source.id ?? "?"}"`,
    );
    // A typo here is invisible at runtime — nothing reads this field — so it
    // has to fail at load or it fails never.
    if (!categoryIds.has(source.category)) {
      fail(
        `source "${source.id}" has category "${source.category}", which is ` +
          `not one of the categories`,
      );
    }
    if (source.enabled !== undefined && typeof source.enabled !== "boolean") {
      fail(`source "${source.id}" enabled must be true or false`);
    }
    if (
      source.alwaysPublish !== undefined &&
      typeof source.alwaysPublish !== "boolean"
    ) {
      fail(`source "${source.id}" alwaysPublish must be true or false`);
    }
    if (
      source.maxPerRun !== undefined &&
      (!Number.isFinite(source.maxPerRun) || source.maxPerRun < 1)
    ) {
      fail(`source "${source.id}" maxPerRun must be at least 1`);
    }
    // A source needs one way in or the other, and scraping needs a pattern
    // that actually compiles — otherwise the failure surfaces mid-run.
    if (!source.feed && !source.scrape) {
      fail(`source "${source.id}" has neither a feed nor a scrape config`);
    }
    if (source.scrape) {
      requireFields(
        source.scrape as unknown as Record<string, unknown>,
        ["index", "pattern", "flags"],
        `source "${source.id}" scrape`,
      );
      if (!source.scrape.flags.includes("g")) {
        fail(`source "${source.id}" scrape.flags must include "g"`);
      }
      try {
        new RegExp(source.scrape.pattern, source.scrape.flags);
      } catch (error) {
        fail(
          `source "${source.id}" scrape.pattern is not a valid regex: ` +
            `${(error as Error).message}`,
        );
      }
    }
  }
  requireUniqueIds(config.sources, "source");

  return config;
}

export const USER_CONFIG = validate(raw);
