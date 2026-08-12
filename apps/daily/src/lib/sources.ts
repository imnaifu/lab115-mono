/**
 * The subscription list. Adding a blog = adding an entry here.
 *
 * Volumes measured 2026-08-10/11, and they are what justify the once-a-day
 * poll: every feed below holds enough items to cover well over 24h, so a single
 * daily fetch cannot miss anything. XDA's *site-wide* feed does not qualify —
 * it publishes ~69 articles/day but only keeps 10 items (~3.5h), which is why
 * we subscribe to a category feed instead.
 *
 * Before adding a source, check `feed item count ÷ posts per day > 1 day`.
 */
/**
 * For sources with no feed at all: parse the listing page instead.
 *
 * A regex rather than a DOM library because the listing markup we care about
 * is a flat run of anchors, and the rest of this file already reads HTML with
 * regexes. If a site ever needs real DOM traversal, that is the signal to add
 * a parser — not to grow this pattern.
 */
export interface ScrapeConfig {
  /** Listing page to fetch. */
  index: string;
  /**
   * One match per post, exposing named groups `url`, `date` and `title`.
   * Must be a global regex.
   */
  pattern: RegExp;
}

export interface Source {
  id: string;
  /** Shown on the cards and in the section headers. */
  name: string;
  /** Homepage — linked from the section header. */
  site: string;
  /** RSS/Atom feed. Empty string when `scrape` is set instead. */
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
  /** Set only when the site publishes no feed. */
  scrape?: ScrapeConfig;
}

export const SOURCES: Source[] = [
  {
    id: "heavybit",
    name: "Heavybit Library",
    site: "https://www.heavybit.com/library",
    feed: "https://www.heavybit.com/library/feed",
    accent: "#3B3563",
    fetchBody: false,
  },
  {
    id: "xda-ai-tools",
    name: "XDA · AI Tools",
    site: "https://www.xda-developers.com/ai-tools/",
    feed: "https://www.xda-developers.com/feed/ai-tools/",
    accent: "#EFA050",
    // XDA's content:encoded is a 90–270 char teaser, never the article.
    fetchBody: true,
  },
  {
    id: "neciudan",
    name: "Neciu Dan’s Blog",
    site: "https://neciudan.dev/",
    feed: "https://neciudan.dev/rss.xml",
    accent: "#4F6D9E",
    // Ships the full article in content:encoded — 28k–74k characters.
    fetchBody: false,
  },
  {
    id: "hn",
    name: "Hacker News",
    site: "https://news.ycombinator.com/",
    // hnrss.org, not HN's own /rss: only the third-party service can filter by
    // score, and an unfiltered front page is mostly noise next to these blogs.
    feed: "https://hnrss.org/frontpage?points=200",
    // HN orange, darkened so it stays distinct from XDA's #EFA050.
    accent: "#D2601A",
    // The feed body is boilerplate ("Article URL … Points: 257"); the real
    // article lives at <link>, on whatever third-party site submitted it.
    fetchBody: true,
  },
  {
    id: "westenberg",
    name: "WESTENBERG",
    site: "https://www.joanwestenberg.com/",
    feed: "https://www.joanwestenberg.com/feed",
    accent: "#7B3F5E",
    // Full text in content:encoded, 1k–8.5k characters.
    fetchBody: false,
  },
  {
    id: "bytecode",
    name: "ByteCode.News",
    site: "https://bytecode.news/",
    feed: "https://bytecode.news/feed.xml",
    accent: "#6E7B3F",
    // Original posts (all 92 items link in-site), but the feed carries only a
    // ~260-char blurb.
    fetchBody: true,
  },
  {
    id: "jacobgold",
    name: "Jake Gold",
    site: "https://jacob.gold/",
    feed: "https://jacob.gold/index.xml",
    accent: "#B08D2E",
    // Description only, and double-encoded (`&lt;p&gt;…`) — always take the
    // article page instead.
    fetchBody: true,
  },
  {
    id: "pueyo",
    name: "Uncharted Territories",
    site: "https://unchartedterritories.tomaspueyo.com/",
    feed: "https://unchartedterritories.tomaspueyo.com/feed",
    accent: "#2E7D6E",
    // Substack: full text for free posts, a ~400-char teaser for paywalled
    // ones. Those fall under SHORT_BODY_CHARS and get a page fetch, which for
    // a paid post still only returns the preview — summarized as such.
    fetchBody: false,
  },
  {
    id: "geohot",
    name: "the singularity is nearer",
    site: "https://geohot.github.io/blog/",
    feed: "https://geohot.github.io/blog/feed.xml",
    accent: "#B4523D",
    // Atom, full content ~3k–5k. Its own links carry a double slash
    // (geohot.github.io//blog/…); harmless, they resolve 200.
    fetchBody: false,
  },
  {
    id: "alienchow",
    name: "Alienchow",
    site: "https://alienchow.dev/",
    // No feed at any of the usual paths — the listing page is the only index.
    feed: "",
    accent: "#8C6D4F",
    fetchBody: true,
    scrape: {
      index: "https://alienchow.dev/",
      // Minified Hugo output, so attribute values are unquoted:
      //   <a href=/post/slug/ class=post-item>
      //     <span class=post-item-date>2026-03-29</span>
      //     <span class=post-item-title>AI Hot Takes …</span>
      pattern:
        /<a\s+href=["']?(?<url>[^"'\s>]+)["']?[^>]*class=["']?post-item\b[^>]*>[\s\S]*?post-item-date[^>]*>(?<date>[^<]+)<[\s\S]*?post-item-title[^>]*>(?<title>[^<]+)</gi,
    },
  },
  {
    id: "nicchan",
    name: "Nic Chan",
    site: "https://www.nicchan.me/blog/",
    feed: "https://www.nicchan.me/feed.xml",
    accent: "#9E5C81",
    // Atom, full content. Dormant since 2026-02 — kept because it costs
    // nothing on the days it publishes nothing.
    fetchBody: false,
  },
  {
    id: "caolan",
    name: "caolan.uk",
    site: "https://caolan.uk/notes/",
    feed: "https://caolan.uk/feed/notes/",
    accent: "#5B7B6A",
    fetchBody: true,
  },
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

/** Falls back to a neutral placeholder so a retired source id never crashes a
 *  page rendered from an older digest. */
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
