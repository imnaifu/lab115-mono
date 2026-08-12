import { USER_CONFIG } from "./user-config";

/**
 * The subscription list, defined in `config.json`. Adding or removing a blog
 * is an edit to that file — no TypeScript involved.
 *
 * Before adding one, check `feed item count ÷ posts per day > 1 day`. That is
 * what makes a once-a-day poll safe, and it is the rule XDA's site-wide feed
 * fails: ~69 articles/day against a 10-item feed covers about 3.5 hours, so a
 * daily fetch would miss 95% of it. Its category feeds pass easily.
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
  /**
   * True when the feed body is known to be a teaser (or absent) and the
   * article page has to be fetched instead. Sources left false still get a
   * page fetch whenever their body comes back suspiciously short — see
   * SHORT_BODY_CHARS in fetcher.ts.
   */
  fetchBody: boolean;
  /**
   * Most cards this source may occupy in one digest. Unset means no limit.
   *
   * Ranking is otherwise purely by score, which hands the page to whichever
   * source publishes most: Hacker News alone once took 10 of 14 cards, and
   * Marginal Revolution posts ~5/day. A cap does not lower those articles'
   * scores — it just lets the next-best article from another source take the
   * slot, and pushes the overflow into the folded list.
   */
  maxPerDay?: number;
  /** Set only when the site publishes no feed. */
  scrape?: ScrapeConfig;
}

export const SOURCES: Source[] = USER_CONFIG.sources.map((source) => ({
  id: source.id,
  name: source.name,
  site: source.site,
  feed: source.feed,
  accent: source.accent,
  fetchBody: source.fetchBody,
  ...(source.maxPerDay ? { maxPerDay: source.maxPerDay } : {}),
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
      fetchBody: false,
    }
  );
}
