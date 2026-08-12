/**
 * The subscription list. Adding a blog = adding an entry here.
 *
 * Volumes measured 2026-08-10, and they are what justify the once-a-day poll:
 * every feed below holds 10+ items covering well over 24h, so a single daily
 * fetch cannot miss anything. XDA's *site-wide* feed does not qualify — it
 * publishes ~69 articles/day but only keeps 10 items (~3.5h), which is why we
 * subscribe to its category feeds instead.
 */
export interface Source {
  id: string;
  /** Shown on the cards and in the section headers. */
  name: string;
  /** Homepage — linked from the section header. */
  site: string;
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
    id: "xda-news",
    name: "XDA · News",
    site: "https://www.xda-developers.com/news/",
    feed: "https://www.xda-developers.com/feed/news/",
    accent: "#C9743A",
    fetchBody: true,
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
