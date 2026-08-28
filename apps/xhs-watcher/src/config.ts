/**
 * Runtime configuration.
 *
 * Two layers:
 *  - process env  → infra-level knobs (paths, cron, delays)
 *  - watches.json → the actual subscriptions, kept on the data volume so they
 *    can be edited without rebuilding the image.
 */
import fs from "node:fs";
import path from "node:path";

export type SortMode = "general" | "time_descending" | "popularity_descending";

export interface WatchConfig {
  /** Stable slug used as the DB foreign key — keywords may contain spaces/emoji. */
  id: string;
  keyword: string;
  sort: SortMode;
  /** Notes below this like count are stored but never reported. */
  minLike: number;
  enabled: boolean;
}

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const config = {
  dataDir: process.env.DATA_DIR ?? "./data",
  /** Playwright persistent profile — this is what keeps us logged in. */
  get profileDir(): string {
    return path.join(config.dataDir, "pw-profile");
  },
  get dbPath(): string {
    return path.join(config.dataDir, "notes.sqlite");
  },
  get watchesPath(): string {
    return path.join(config.dataDir, "watches.json");
  },

  cron: process.env.CRON ?? "*/45 * * * *",
  timezone: process.env.TZ ?? "Asia/Shanghai",
  runOnStart: envBool("RUN_ON_START", true),
  headless: envBool("HEADLESS", true),

  /** How many "load more" scrolls per keyword. 0 = first screen only (~20 notes). */
  scrolls: envInt("SCROLLS", 0),
  /** Politeness delay between keywords, randomised in [min, max] ms. */
  delayMinMs: envInt("DELAY_MIN_MS", 3000),
  delayMaxMs: envInt("DELAY_MAX_MS", 8000),

  /**
   * On a watch's very first run, record everything as seen WITHOUT reporting it —
   * otherwise the first digest is a 20-item dump of pre-existing notes.
   */
  seedOnFirstRun: envBool("SEED_ON_FIRST_RUN", true),
  /**
   * Notes with a known publish time older than this are stored (so they never
   * re-trigger) but not reported — search results mix in popular old posts.
   */
  maxAgeDays: envInt("MAX_AGE_DAYS", 7),

  /** Don't repeat the same "login expired" alert on every failed cycle. */
  alertCooldownHours: envInt("ALERT_COOLDOWN_HOURS", 6),
  /** After N consecutive failures, skip cycles instead of hammering a blocked account. */
  backoffAfterFailures: envInt("BACKOFF_AFTER_FAILURES", 3),
  backoffHours: envInt("BACKOFF_HOURS", 6),
};

const DEFAULT_WATCH: Omit<WatchConfig, "id" | "keyword"> = {
  sort: "time_descending",
  minLike: 0,
  enabled: true,
};

/** kebab-ish slug; falls back to a hash-free index suffix for non-ASCII keywords. */
function slugify(keyword: string, index: number): string {
  const ascii = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || `watch-${index + 1}`;
}

/**
 * Loads watches.json, seeding it from the KEYWORDS env var on first boot so a
 * fresh deploy works with nothing but environment variables.
 */
export function loadWatches(): WatchConfig[] {
  if (!fs.existsSync(config.watchesPath)) {
    const keywords = (process.env.KEYWORDS ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const seeded: WatchConfig[] = keywords.map((keyword, index) => ({
      id: slugify(keyword, index),
      keyword,
      ...DEFAULT_WATCH,
    }));
    fs.mkdirSync(path.dirname(config.watchesPath), { recursive: true });
    fs.writeFileSync(config.watchesPath, `${JSON.stringify(seeded, null, 2)}\n`);
    return seeded;
  }

  const parsed = JSON.parse(fs.readFileSync(config.watchesPath, "utf8")) as Partial<WatchConfig>[];
  return parsed
    .filter((watch): watch is Partial<WatchConfig> & { keyword: string } => Boolean(watch?.keyword))
    .map((watch, index) => ({
      ...DEFAULT_WATCH,
      ...watch,
      id: watch.id ?? slugify(watch.keyword, index),
      keyword: watch.keyword,
    }));
}
