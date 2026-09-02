import type { Lang } from "./lang";
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
 * feed — COLLECT_PER_SOURCE is global, so it cannot be raised for one source.
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
  /**
   * One line on what it publishes, and its known failure modes.
   *
   * TWO AUDIENCES IN ONE FIELD, which is worth knowing before editing it. It was
   * written for whoever reviews the list — hence the feed measurements and the
   * per-day rates in some of them — and `/s` now renders it to readers as well.
   * The English twin below carries only the reader-facing half.
   */
  description: string;
  /** The same line in English. See RawSource.descriptionEn for why it is
   *  required and what it deliberately leaves out. */
  descriptionEn: string;
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
  /** Set only when the site publishes no feed. */
  scrape?: ScrapeConfig;
}

/**
 * How many of one source's articles a run PAYS FOR — applied after the time
 * window and BEFORE bodies are fetched, so it caps both the page requests and
 * the scoring tokens. Selection is by recency, the only ordering that exists
 * before scoring.
 *
 * Hacker News alone was once 13 of 27 articles and 53% of all body text,
 * because it links to arbitrary sites and each one is fetched up to
 * BODY_CHAR_LIMIT.
 */
export const COLLECT_PER_SOURCE = USER_CONFIG.collectPerSource;

/**
 * How many of one source's collected articles reach the PAGE — applied after
 * scoring, so the ones kept are the highest-scoring rather than the newest.
 *
 * THIS IS THE LAYOUT QUOTA COMING BACK, and knowing why it left matters. The
 * old `Source.maxPerDay` capped cards per source because ranking purely by
 * score meant whoever published most owned the page (one day Hacker News held
 * 10 of 14 cards). It needed a second backfill pass, because the page had a
 * fixed slot count and quotas left slots empty on quiet days. The page has no
 * fixed slot count any more — everything over the floor is drawn — so there is
 * nothing to backfill, and the quota now sits BEFORE the summary spend rather
 * than after it, so what it saves is real money and not just space.
 *
 * See RawConfig.publishPerSource in user-config.ts for why this is a separate
 * number from COLLECT_PER_SOURCE rather than one cap applied earlier.
 */
export const PUBLISH_PER_SOURCE = USER_CONFIG.publishPerSource;

/**
 * How many published takes a source needs before it gets a page of its own.
 *
 * THE SAME SHAPE AS `hasArchive` IN LIB/PAGING, and for the same reason. A source
 * page's content is the run of takes we have written about that blog; with one of
 * them on it the page is a heading, a borrowed description and a single link that
 * the article's own page already carries better. Sixty-four such pages is the
 * definition of a doorway set, and this site is a daily pile of summaries of other
 * people's writing — which is close enough to what Google's scaled-content policy
 * describes that thin pages are a risk it should not take for free.
 *
 * THREE, measured rather than picked: over the first fourteen days, 44 sources had
 * published at least once, 33 at least twice and 25 at least three times. So the
 * threshold turns on roughly the sources that appear about weekly, and the quiet
 * ones arrive on their own as the archive fills — a page that does not exist yet
 * is the honest answer, and it is why the route 404s below the line rather than
 * rendering an empty run.
 *
 * IT GATES THREE THINGS AT ONCE, stated once here: the route (404), the sitemap
 * (not listed), and the index at `/s` (named as plain text rather than linked).
 * A URL that is listed but 404s, or linked but not listed, is the kind of
 * disagreement `hasArchive` exists to prevent one route over.
 */
export const SOURCE_MIN_ARTICLES = 3;

/** Whether a source with this many published takes has a page. See the note
 *  above — every caller asks through here rather than comparing the number. */
export function hasSourcePage(published: number): boolean {
  return published >= SOURCE_MIN_ARTICLES;
}

export const SOURCES: Source[] = USER_CONFIG.sources.map((source) => ({
  id: source.id,
  name: source.name,
  site: source.site,
  feed: source.feed,
  accent: source.accent,
  category: source.category,
  description: source.description,
  descriptionEn: source.descriptionEn,
  enabled: source.enabled ?? true,
  alwaysPublish: source.alwaysPublish ?? false,
  fetchBody: source.fetchBody,
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
/**
 * The line about a source, in the language being rendered.
 *
 * ONE RULE, IN ONE PLACE, because two components ask: the directory row and the
 * source page's own lead paragraph. Both used to gate on `lang === "zh"` and show
 * nothing at all on the English side, which is the hole `descriptionEn` fills.
 *
 * It can still come back empty — `sourceOf`'s placeholder has no description of
 * either kind, for a source id that has been removed from config.json — so every
 * caller still has to branch on the empty string. That is a real state, not a
 * defensive check: an archived digest naming a retired source renders through
 * that placeholder.
 */
export function descriptionFor(source: Source, lang: Lang): string {
  return lang === "zh" ? source.description : source.descriptionEn;
}

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
      descriptionEn: "",
      enabled: false,
      alwaysPublish: false,
      fetchBody: false,
    }
  );
}
