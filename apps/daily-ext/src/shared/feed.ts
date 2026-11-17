/**
 * Reading daily.lab115.com's Atom feed — the extension's only data source.
 *
 * WHY THE FEED AND NOT THE DIGEST JSON: the digests live in a private GitHub
 * repo, and the site has no JSON API. The feed is public, already carries the
 * whole take (not a teaser), and is cached at the edge for 30 minutes.
 *
 * THE FORMAT IS WRITTEN BY apps/daily/src/lib/feed.ts (`entryFor` and
 * `contentHtml`). Everything this file relies on was read off that code, not
 * guessed from a sample:
 *   - one feed per language: `/feed.xml` is Chinese, `/en/feed.xml` English;
 *   - entries are grouped newest digest first, and inside a day in rank order;
 *   - the entry's link is the article page, whose path carries the DIGEST date
 *     (`/2026/11/13/<slug>`). `<published>` is the original article's date and
 *     must not be used for grouping;
 *   - `<content type="html">` is the take, escaped once as a whole.
 * If that writer changes, this reader is the thing that breaks.
 *
 * Parsed with string matching rather than DOMParser, because this module also
 * runs in the background service worker, which has no DOM. That is safe here
 * only because the feed is machine-written by one known generator.
 */

export type Lang = "zh" | "en";

export const SITE = "https://daily.lab115.com";

export interface Entry {
  /** The article page URL on daily.lab115.com; also the Atom `<id>`. */
  link: string;
  /** The digest date, `YYYY-MM-DD`, taken from the link's path. */
  date: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  /** The take as HTML markup (`<p>`, `<h3>`, `<a>`), text still entity-escaped. */
  html: string;
}

export interface Feed {
  lang: Lang;
  /** The feed's own `<updated>`: when the newest digest was generated. */
  updated: string;
  entries: Entry[];
  /** When this copy was fetched (ms since epoch) — shown when serving stale. */
  fetchedAt: number;
}

export function feedUrl(lang: Lang): string {
  return lang === "zh" ? `${SITE}/feed.xml` : `${SITE}/en/feed.xml`;
}

/** The site's home and day pages, with the same language prefix rule as the site's `href`. */
export function siteUrl(lang: Lang, path = "/"): string {
  if (lang === "zh") return `${SITE}${path}`;
  return path === "/" ? `${SITE}/en` : `${SITE}/en${path}`;
}

export function dayUrl(lang: Lang, date: string): string {
  return siteUrl(lang, `/${date.split("-").join("/")}`);
}

const ENTITY = /&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi;
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/**
 * Undo ONE level of XML escaping, in a single pass.
 *
 * Single pass matters: `&amp;lt;` must become `&lt;`, not `<`. The content
 * element is escaped twice over (text inside the markup, then the markup as a
 * whole), and only the outer level belongs to the XML.
 */
export function decodeXml(text: string): string {
  return text.replace(ENTITY, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

function tag(xml: string, name: string): string | null {
  const found = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return found ? found[1] : null;
}

function attr(element: string, name: string): string | null {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(element);
  return found ? decodeXml(found[1]) : null;
}

const DATE_IN_PATH = /\/(\d{4})\/(\d{2})\/(\d{2})\/[^/]+$/;

function parseEntry(xml: string): Entry | null {
  const link = decodeXml(tag(xml, "id") ?? "").trim();
  const day = DATE_IN_PATH.exec(link);
  // An entry whose URL no longer carries a date means the site's URL scheme
  // changed; dropping it is better than filing it under the wrong day.
  if (!day || !link.startsWith(SITE)) return null;

  const category = /<category\s[^>]*\/>/.exec(xml)?.[0] ?? "";
  return {
    link,
    date: `${day[1]}-${day[2]}-${day[3]}`,
    title: decodeXml(tag(xml, "title") ?? "").trim(),
    categoryId: attr(category, "term") ?? "",
    categoryLabel: attr(category, "label") ?? "",
    html: decodeXml(tag(xml, "content") ?? ""),
  };
}

export function parseFeed(xml: string, lang: Lang, fetchedAt = Date.now()): Feed {
  // A captive portal or an error page answers 200 too; refuse anything that is
  // not an Atom document rather than caching it as "a feed with no entries".
  if (!/<feed[\s>]/.test(xml)) throw new Error("not an Atom feed");
  const head = xml.split("<entry>")[0];
  const entries: Entry[] = [];
  for (const block of xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
    const entry = parseEntry(block);
    if (entry) entries.push(entry);
  }
  return {
    lang,
    updated: (tag(head, "updated") ?? "").trim(),
    entries,
    fetchedAt,
  };
}

/** Distinct digest dates, newest first. */
export function datesOf(feed: Feed): string[] {
  return [...new Set(feed.entries.map((entry) => entry.date))].sort().reverse();
}

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchFeed(lang: Lang): Promise<Feed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // `no-cache` revalidates with the edge instead of trusting the browser's
    // copy; the edge itself may still answer from its 30-minute cache, which is
    // fine — the digest only changes once a day.
    const response = await fetch(feedUrl(lang), {
      cache: "no-cache",
      // No cookies, ever: the privacy page promises these requests carry nothing
      // that identifies the reader, and this makes that true by construction.
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(await response.text(), lang);
  } finally {
    clearTimeout(timer);
  }
}
