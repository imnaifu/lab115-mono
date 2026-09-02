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
   *  ON THE 6-60 SCALE, not 0-100 — see SCORE_WEIGHTS in summarize.ts. 36 is
   *  60% of the 60 maximum. See PUBLISH_MIN_SCORE in categories.ts. */
  publishMinScore: number;
  /**
   * The floor under each dimension separately — see MIN_PER_DIMENSION in
   * score.ts for what it is for and why it is 5 rather than 6.
   */
  minPerDimension: number;
  /**
   * THE PER-SOURCE PAIR, and they are two limits because they buy two different
   * things. Both are global: every source gets the same two numbers.
   *
   * `collectPerSource` is how many of a source's articles are PAID FOR — it is
   * applied after the time window and before any body is fetched, so it caps
   * the page requests and the scoring tokens. Selection there is by recency,
   * the only ordering that exists before scoring.
   *
   * `publishPerSource` is how many of them can reach the PAGE, and it is
   * applied after scoring, so selection there is by score. That ordering is the
   * whole reason the two are separate: a cap of 1 on collection alone would
   * keep each source's NEWEST article, and over the nine archived days that
   * dropped five articles that outscored the one kept in their place — 08-28
   * would have kept a newer Conversation piece over the 37-point one on
   * antibiotics. Collecting three and publishing the best of them costs three
   * score calls per source and never drops a source's best article.
   *
   * They replaced `sources[].maxPerRun`, which was set on eleven sources and
   * absent on the rest — the answer to "how many can this source send" was
   * eleven different numbers and a default of infinity. It also pointed at the
   * wrong thing: the busy days were never one source flooding (08-28 was 32
   * articles from 22 sources), so what needed limiting was how many of a
   * source's articles reach the page, not how many arrive.
   */
  collectPerSource: number;
  publishPerSource: number;
  /** Bounds for one article's Chinese summary, in characters. */
  summaryMinChars: number;
  summaryMaxChars: number;
  /** Ceiling on ONE paragraph. Deliberately not derived from summaryMaxChars —
   *  see PARA_MAX in summarize.ts for why the two move independently. */
  summaryParaMaxChars: number;
  /**
   * Whether the day page opens on a photograph — Wikimedia's picture of the day.
   *
   * FALSE STOPS THE FETCH, NOT THE RENDERING, which is the same distinction
   * `sources[].enabled` draws: an archived digest that already carries a `photo`
   * keeps showing it, because that day did have one and repainting history is
   * not what turning this off means. It saves one HTTP request and at most one
   * model call per run.
   */
  photoEnabled: boolean;
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
  // Above 10 nothing can ever clear it and every digest is empty; at 1 it is a
  // rule that cannot fire, since the model's scale starts there.
  if (
    !Number.isInteger(config.minPerDimension) ||
    config.minPerDimension < 1 ||
    config.minPerDimension > 10
  ) {
    fail("minPerDimension must be a whole number between 1 and 10");
  }
  for (const key of ["collectPerSource", "publishPerSource"] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 1) {
      fail(`${key} must be a whole number of at least 1`);
    }
  }
  // Publishing more per source than is collected is not a stricter or looser
  // setting, it is a number that cannot happen: the publish step only ever sees
  // what collection brought back. Reading it as "publish everything collected"
  // would hide a typo that was meant to change something.
  if (config.publishPerSource > config.collectPerSource) {
    fail(
      `publishPerSource (${config.publishPerSource}) is above ` +
        `collectPerSource (${config.collectPerSource}) — a source can never ` +
        `publish more articles than the run collects from it`,
    );
  }
  if ((config as unknown as Record<string, unknown>).maxPerRun !== undefined) {
    fail(
      `maxPerRun is gone — it is now the pair "collectPerSource" (how many of ` +
        `a source's articles are fetched and scored) and "publishPerSource" ` +
        `(how many of those reach the page)`,
    );
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
  if (typeof config.photoEnabled !== "boolean") {
    fail("photoEnabled must be true or false");
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
    // The cap moved to the top level, and a per-source one left behind here
    // would be read by nobody. Throw rather than ignore it: a cap that is
    // silently not applied looks exactly like a cap that is, and the source
    // would quietly send as many articles as it likes.
    if (
      (source as unknown as Record<string, unknown>).maxPerRun !== undefined
    ) {
      fail(
        `source "${source.id}" still carries maxPerRun — the caps are now the ` +
          `global "collectPerSource" and "publishPerSource" at the top level ` +
          `of config.json, and they apply to every source`,
      );
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
