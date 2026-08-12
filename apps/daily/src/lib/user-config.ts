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
  accent: string;
  fetchBody: boolean;
  maxPerDay?: number;
  scrape?: RawScrape;
}

export interface RawCategory {
  id: string;
  name: string;
  nameEn: string;
  accent: string;
  maxPerDay: number;
  hint: string;
}

interface RawConfig {
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
    if (!Number.isFinite(category.maxPerDay) || category.maxPerDay < 1) {
      fail(`category "${category.id}" needs a maxPerDay of at least 1`);
    }
  }
  requireUniqueIds(config.categories, "category");

  if (!config.categories.some((c) => c.id === config.fallbackCategory)) {
    fail(
      `fallbackCategory "${config.fallbackCategory}" is not one of the ` +
        `categories — an unclassified article would have nowhere to go`,
    );
  }

  for (const source of config.sources) {
    requireFields(
      source as unknown as Record<string, unknown>,
      ["id", "name", "site", "accent"],
      `source "${source.id ?? "?"}"`,
    );
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
