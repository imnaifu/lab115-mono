import { USER_CONFIG } from "./user-config";

/**
 * The subscription list, defined in `config.json`. Adding or removing a blog
 * is an edit to that file — no TypeScript involved.
 *
 * Two checks before adding one, and they pull in opposite directions.
 *
 * A CEILING on volume: `feed item count ÷ posts per day > 1 day`, which is what
 * makes a once-a-day poll safe. XDA's site-wide feed is the case that fails it —
 * ~69 articles/day against a 10-item feed covers about 3.5 hours, so a daily
 * fetch would miss 95% of what it published. A source that busy needs a section
 * feed, or a `maxPerRun`, or both.
 *
 * A FLOOR on volume: more than one post a MONTH. Deliberately low. A blog that
 * publishes three essays a month contributes on the days it publishes and is
 * simply absent on the others, which costs nothing — the digest is assembled
 * from whatever appeared, not from a quota per source. Rejecting quiet blogs
 * would drop exactly the writers who post only when they have something.
 */
export interface ScrapeConfig {
  /** Listing page to fetch. */
  index: string;
  /**
   * One match per post, exposing named groups `url`, `date` and `title`.
   * Compiled from the pattern/flags strings in config.json; the flags must
   * include `g`.
   *
   * A regex rather than a DOM library because the listing markup we care about
   * is a flat run of anchors. If a site ever needs real DOM traversal, that is
   * the signal to add a parser — not to grow this pattern.
   */
  pattern: RegExp;
}

export interface Source {
  id: string;
  /** Shown on the cards and in the status chips. */
  name: string;
  /** Homepage. */
  site: string;
  /** RSS/Atom feed. Empty when `scrape` is set instead. */
  feed: string;
  /** Card accent; also seeds the gradient cover when an article has no image. */
  accent: string;
  /** A `Category.id` describing the source's usual beat. Editorial metadata for
   *  reviewing the list — the model still classifies every article on its own. */
  category: string;
  /** One line on what it publishes, and its known failure modes. */
  description: string;
  /** Exempt from the publish floor — see alwaysPublish in user-config.ts. */
  alwaysPublish: boolean;
  /** False means "do not fetch". Such a source is still carried here, and on
   *  purpose: sourceOf() is what renders archived digests, and dropping the
   *  entry would turn every past article of a parked source into a bare id with
   *  a dead link. Fetching reads ACTIVE_SOURCES instead. */
  enabled: boolean;
  /**
   * True when the feed body is known to be a teaser (or absent) and the
   * article page has to be fetched instead. Sources left false still get a
   * page fetch whenever their body comes back suspiciously short — see
   * SHORT_BODY_CHARS in fetcher.ts.
   */
  fetchBody: boolean;
  /**
   * Cap on how many of this source's articles enter a run AT ALL — applied
   * after the time window and BEFORE bodies are fetched, so it saves both the
   * page requests and the summarizer's input tokens.
   *
   * Not to be confused with the layout quota that used to live here: that one
   * decided how many CARDS a source could occupy and was removed. This one
   * decides how many articles are paid for. Hacker News alone was 13 of 27
   * articles and 53% of all body text, because it links to arbitrary sites and
   * each one is fetched up to BODY_CHAR_LIMIT.
   *
   * Selection is by recency, the only ordering available before scoring.
   */
  maxPerRun?: number;
  /** Set only when the site publishes no feed. */
  scrape?: ScrapeConfig;
}

export const SOURCES: Source[] = USER_CONFIG.sources.map((source) => ({
  id: source.id,
  name: source.name,
  site: source.site,
  feed: source.feed,
  accent: source.accent,
  category: source.category,
  description: source.description,
  enabled: source.enabled ?? true,
  alwaysPublish: source.alwaysPublish ?? false,
  fetchBody: source.fetchBody,
  ...(source.maxPerRun ? { maxPerRun: source.maxPerRun } : {}),
  ...(source.scrape
    ? {
        scrape: {
          index: source.scrape.index,
          // Validated in user-config.ts, so this cannot throw here.
          pattern: new RegExp(source.scrape.pattern, source.scrape.flags),
        },
      }
    : {}),
}));

/** The ones a run actually fetches. SOURCES keeps the parked ones so old pages
 *  still render; this is what the fetcher iterates. */
export const ACTIVE_SOURCES = SOURCES.filter((s) => s.enabled);

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

/** Falls back to a neutral placeholder so a source id that has since been
 *  removed from config.json never crashes a page rendered from an older
 *  digest. */
export function sourceOf(id: string): Source {
  return (
    SOURCE_BY_ID.get(id) ?? {
      id,
      name: id,
      site: "#",
      feed: "",
      accent: "#8A8299",
      category: USER_CONFIG.fallbackCategory,
      description: "",
      enabled: false,
      alwaysPublish: false,
      fetchBody: false,
    }
  );
}
