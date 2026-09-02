import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { BODY_CHAR_LIMIT, dailyWindow } from "./config";
import { readingMinutes } from "./reading";
import {
  ACTIVE_SOURCES,
  COLLECT_PER_SOURCE,
  sourceOf,
  type Source,
} from "./sources";
import type { SourceStatus } from "./types";

/** An article after parsing, before the model has seen it. */
export interface RawArticle {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  author: string | null;
  publishedAt: string;
  image: string | null;
  readingMinutes: number;
  /** Plain text, already truncated to BODY_CHAR_LIMIT. */
  body: string;
}

// Several of these sites 403 a bare fetch, so present as a normal browser.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Below this many characters a feed body is a teaser, not an article, and we
 * go fetch the page instead. Calibrated against the actual feeds: XDA ships
 * 90–270 char blurbs, Heavybit's podcast entries ~500, while its written posts
 * run 17k. Anything under ~1200 is not something worth summarizing.
 */
const SHORT_BODY_CHARS = 1200;

/**
 * Below this, whatever we hold is not an article and is worse than nothing —
 * HN's feed body is ~150 characters of "Article URL … Points: 257", and
 * summarizing *that* invents an article. An empty body makes the prompt say
 * "judge from the title alone", which is at least honest.
 */
const MIN_USEFUL_BODY = 200;

/**
 * Cap on simultaneous article-page fetches.
 *
 * Bodies used to be fetched with an unbounded `Promise.all`. That was fine
 * while every source was a handful of known blogs, but HN links to arbitrary
 * third-party sites — any one of which can sit on a socket for the full
 * FETCH_TIMEOUT_MS — and a wide window turns that into hundreds of parallel
 * connections. With a cap the worst case is bounded at
 * ceil(articles / limit) × timeout.
 */
const BODY_FETCH_CONCURRENCY = 6;

/** Like Promise.all over a mapper, but with at most `limit` in flight. */
async function mapLimited<In, Out>(
  items: In[],
  limit: number,
  mapper: (item: In) => Promise<Out>,
): Promise<Out[]> {
  const results = new Array<Out>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index]);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // A feed with exactly one item would otherwise parse to an object, not an
  // array, and every downstream `.map` would break.
  isArray: (name) => name === "item" || name === "entry",
  trimValues: true,
  // Titles routinely contain &amp; / &#8217; — decode them once, here.
  processEntities: true,
});

async function get(url: string, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** fast-xml-parser hands back a string, a number, or {#text} depending on the
 *  node — flatten all three to a string. */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/**
 * One pass over every entity, so `&amp;lt;` decodes to the literal `&lt;`
 * rather than being decoded twice into `<`. Numeric forms have to accept
 * leading zeros — XDA emits `&#039;`, not `&#39;`.
 *
 * EXPORTED for lib/photo.ts, which has the same problem from a different
 * direction: Wikimedia's `description.text` is already stripped of tags but
 * still carries entities (`published by Ackermann &amp; Co.`). A second copy of
 * this table there would be a second place for it to fall behind.
 */
export function decodeEntities(input: string): string {
  return input.replace(
    /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g,
    (match, dec: string, hex: string, name: string) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED_ENTITIES[name] ?? match;
    },
  );
}

const TAGS = /<[^>]+>/g;
const SCRIPTS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Two strip passes, not one. Some feeds double-encode their markup —
 * jacob.gold ships `&lt;p&gt;US residential proxies…` — so decoding entities
 * *produces* tags that were not there before. Without the second pass those
 * land in the body as literal "<p>" for the model to read.
 */
function stripHtml(html: string): string {
  const once = decodeEntities(html.replace(SCRIPTS, " ").replace(TAGS, " "));
  return once.replace(SCRIPTS, " ").replace(TAGS, " ").replace(/\s+/g, " ").trim();
}

/** First <img src> in the entry body, used when the feed has no enclosure. */
function firstImage(html: string): string | null {
  const m = html.match(/<img\b[^>]*?\bsrc=["']([^"']+)["']/i);
  const src = m?.[1];
  return src && /^https?:\/\//i.test(src) ? src : null;
}

/**
 * The article page's own social-card image, for feeds that ship no image at
 * all. Recovers roughly 5 of every 6 missing covers.
 */
function socialImage(html: string, pageUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (!found) continue;
    try {
      // Plenty of sites give a root-relative og:image.
      return new URL(found, pageUrl).toString();
    } catch {
      /* unusable value — try the next pattern */
    }
  }
  return null;
}

/**
 * Drop images that turn out to be a site-wide default rather than an
 * illustration of the article.
 *
 * Marginal Revolution's og:image is the same 2016 logo on every post, so
 * naively trusting og:image put five identical thumbnails on the page — worse
 * than the gradient placeholder it was meant to replace. Rather than
 * maintaining a blocklist of logo URLs, spot it structurally: within one run,
 * an image URL reused by more than one article from the same source is a
 * template, not a photograph.
 */
function dropRepeatedImages(articles: RawArticle[]): void {
  const seen = new Map<string, RawArticle[]>();
  for (const article of articles) {
    if (!article.image) continue;
    /**
     * `\u0000`, the escape and not a literal NUL byte.
     *
     * The separator has to be something neither a source id nor a URL can
     * contain, and NUL is the honest choice for that. Writing it as a raw byte in
     * the source was not: `file` reports this module as `data` and grep treats it
     * as binary, so a plain `grep readingMinutes src/` silently skips the whole
     * file — which is how the import above came to look unused during a cleanup
     * that nearly deleted it. The escape compiles to the same character and keeps
     * the file text.
     */
    const key = `${article.sourceId}\u0000${article.image}`;
    const bucket = seen.get(key);
    if (bucket) bucket.push(article);
    else seen.set(key, [article]);
  }

  for (const [, group] of seen) {
    if (group.length < 2) continue;
    for (const article of group) article.image = null;
    console.log(
      `[daily] ${sourceOf(group[0].sourceId).name}: dropped a cover shared by ` +
        `${group.length} articles — it is a site default, not an illustration`,
    );
  }
}

/** Atom <link> can be a bare object, an array, or carry rel="alternate". */
function atomLink(entry: Record<string, unknown>): string {
  const raw = entry.link;
  const links = Array.isArray(raw) ? raw : [raw];
  const candidates = links.filter(Boolean) as Record<string, unknown>[];
  const alternate =
    candidates.find((l) => l["@_rel"] === "alternate" || l["@_rel"] == null) ??
    candidates[0];
  if (!alternate) return "";
  return String(alternate["@_href"] ?? text(alternate));
}

/** Drop tracking params so the same article from two category feeds collapses
 *  to one id. */
function canonical(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(key)) {
        u.searchParams.delete(key);
      }
    }
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function idOf(url: string): string {
  return crypto.createHash("sha1").update(canonical(url)).digest("hex");
}

/** Normalize one RSS <item> or Atom <entry> into a common shape. */
function normalize(
  node: Record<string, unknown>,
  source: Source,
): Omit<RawArticle, "readingMinutes" | "body"> & { bodyHtml: string } | null {
  const title = stripHtml(text(node.title));
  const url = canonical(
    typeof node.link === "string" ? node.link : atomLink(node),
  );
  if (!title || !url) return null;

  const dateRaw =
    text(node.pubDate) ||
    text(node.published) ||
    text(node.updated) ||
    text(node["dc:date"]);
  const published = new Date(dateRaw);
  if (Number.isNaN(published.getTime())) return null;

  // Order matters: content:encoded / <content> hold the full post, while
  // <description> / <summary> are usually just a teaser.
  const bodyHtml =
    text(node["content:encoded"]) ||
    text(node.content) ||
    text(node.description) ||
    text(node.summary) ||
    "";

  const enclosure = node.enclosure as Record<string, unknown> | undefined;
  const enclosureUrl =
    enclosure && String(enclosure["@_type"] ?? "").startsWith("image")
      ? String(enclosure["@_url"] ?? "")
      : "";
  const media = node["media:content"] as Record<string, unknown> | undefined;
  const mediaUrl = media ? String(media["@_url"] ?? "") : "";

  return {
    id: idOf(url),
    sourceId: source.id,
    title,
    url,
    author: stripHtml(text(node["dc:creator"]) || text(node.author)) || null,
    publishedAt: published.toISOString(),
    image: enclosureUrl || mediaUrl || firstImage(bodyHtml),
    bodyHtml,
  };
}

/**
 * Pull the article body off its own page. Only used for caolan.uk, whose feed
 * carries no content at all. Best-effort: if no <article>/<main> is present we
 * fall back to the whole document, which still beats an empty body.
 */
async function fetchPage(
  url: string,
): Promise<{ body: string; image: string | null }> {
  const html = await get(url, "text/html");
  const scoped =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html;
  // One request serves both needs — the page is already in hand.
  return { body: stripHtml(scoped), image: socialImage(html, url) };
}

/** Shape shared by the feed and scrape paths, before bodies are resolved. */
type Candidate = Omit<RawArticle, "readingMinutes" | "body"> & {
  bodyHtml: string;
};

async function parseFeed(source: Source): Promise<Candidate[]> {
  const xml = await get(source.feed, "application/rss+xml, application/xml");
  const doc = parser.parse(xml) as Record<string, any>;

  // RSS 2.0 nests items under rss.channel; Atom puts entries at feed level.
  const nodes: Record<string, unknown>[] =
    doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.channel?.item ?? [];

  return nodes
    .map((node) => normalize(node, source))
    .filter((a): a is Candidate => a !== null);
}

/**
 * The no-feed path: pull posts out of a listing page. Produces the same
 * candidates as parseFeed, minus any body — scraped sources always have to
 * fetch the article page, which is why they set `fetchBody`.
 */
async function parseListing(source: Source): Promise<Candidate[]> {
  const config = source.scrape!;
  const html = await get(config.index, "text/html");
  const out: Candidate[] = [];

  for (const match of html.matchAll(config.pattern)) {
    const groups = match.groups ?? {};
    const title = stripHtml(groups.title ?? "");
    if (!title || !groups.url || !groups.date) continue;

    // Listing links are usually root-relative.
    const url = canonical(new URL(groups.url, config.index).toString());
    const published = new Date(groups.date.trim());
    if (Number.isNaN(published.getTime())) continue;

    out.push({
      id: idOf(url),
      sourceId: source.id,
      title,
      url,
      author: null,
      publishedAt: published.toISOString(),
      image: null,
      bodyHtml: "",
    });
  }

  return out;
}

async function fetchSource(
  source: Source,
  from: Date,
  to: Date,
): Promise<RawArticle[]> {
  const candidates = source.scrape
    ? await parseListing(source)
    : await parseFeed(source);

  let parsed = candidates.filter((a) => {
    // No cross-day dedup state by design — the publication window *is* the
    // filter, so a run only ever sees the last WINDOW_HOURS of each source.
    const at = new Date(a.publishedAt).getTime();
    return at >= from.getTime() && at < to.getTime();
  });

  // Applied HERE, before any body is fetched: the point of the cap is to not
  // pay for these articles, and both the page requests and the summarizer's
  // input tokens are spent below. Capping later would save nothing.
  if (parsed.length > COLLECT_PER_SOURCE) {
    const dropped = parsed.length - COLLECT_PER_SOURCE;
    parsed = [...parsed]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, COLLECT_PER_SOURCE);
    console.log(
      `[daily] ${source.name}: kept the newest ${COLLECT_PER_SOURCE}, ` +
        `skipped ${dropped}`,
    );
  }

  return mapLimited(
    parsed,
    BODY_FETCH_CONCURRENCY,
    async ({ bodyHtml, ...rest }) => {
      let plain = stripHtml(bodyHtml);
      let image = rest.image;
      // Fetch the page when the body is thin OR when we still have no cover —
      // the two needs are served by the same single request.
      if (source.fetchBody || plain.length < SHORT_BODY_CHARS || !image) {
        // A failed fetch must not lose the article — keep what we had.
        try {
          const page = await fetchPage(rest.url);
          if (page.body.length > plain.length) plain = page.body;
          image = image ?? page.image;
        } catch {
          /* keep the feed-provided text and cover */
        }
      }
      if (plain.length < MIN_USEFUL_BODY) plain = "";
      return {
        ...rest,
        image,
        readingMinutes: readingMinutes(plain),
        body: plain.slice(0, BODY_CHAR_LIMIT),
      };
    },
  );
}

/**
 * The body of ONE article, fetched from its own page. "" when it cannot be had.
 *
 * FOR REWRITING A TAKE THAT ALREADY SHIPPED. A published digest carries no
 * bodies — `Digest` has no such field, so the file that lands in git is the
 * published shape and the working file's bodies are overwritten by it. That
 * used to mean `npm run summary` on a day it had already published could only
 * work from headlines. This is where the body comes back from.
 *
 * IT IS NOT NECESSARILY THE TEXT THAT WAS SCORED, and the difference is real
 * rather than theoretical: a third-party page can be edited, paywalled or gone
 * hours later, so a rewrite may be reading a different article than the score
 * was given to. That is the price of redoing a day after the fact. Nothing
 * calls this during a normal run — `fetchAll` resolves bodies once, at fetch
 * time, and the summary pass uses those.
 *
 * NEVER THROWS. Every caller's next move on a failure is the same — carry on
 * with no body — so the failure is returned as "" rather than as an exception
 * each of them would have to catch.
 */
export async function bodyFor(url: string): Promise<string> {
  try {
    const page = await fetchPage(url);
    // The same two thresholds the fetch path applies, so a body that arrives
    // here is one `fetchAll` would also have accepted: too short is no body at
    // all, and the model never sees more than BODY_CHAR_LIMIT of it.
    if (page.body.length < MIN_USEFUL_BODY) return "";
    return page.body.slice(0, BODY_CHAR_LIMIT);
  } catch {
    return "";
  }
}

export interface FetchResult {
  articles: RawArticle[];
  statuses: SourceStatus[];
  window: { from: Date; to: Date };
}

/**
 * Fetch every source for the daily window containing `now`. Sources are
 * independent: one failing feed is recorded in `statuses` and the rest still
 * ship.
 */
export async function fetchAll(now: Date): Promise<FetchResult> {
  // The window is the fixed daily slot around `now`, not 24h measured back from
  // it — see dailyWindow() for why the difference matters.
  const { from, to } = dailyWindow(now);

  // ACTIVE_SOURCES, not SOURCES: a source with `enabled: false` is parked, and
  // a parked source is not a failed one — it gets no request and no status row.
  const settled = await Promise.allSettled(
    ACTIVE_SOURCES.map((s) => fetchSource(s, from, to)),
  );

  const statuses: SourceStatus[] = [];
  const seen = new Set<string>();
  const articles: RawArticle[] = [];

  settled.forEach((result, i) => {
    const source = ACTIVE_SOURCES[i];
    if (result.status === "rejected") {
      statuses.push({
        id: source.id,
        name: source.name,
        ok: false,
        count: 0,
        error: String(result.reason?.message ?? result.reason).slice(0, 200),
      });
      return;
    }
    // Within-run dedup: XDA's ai-tools and news feeds overlap, and the first
    // feed to claim an article keeps it.
    let kept = 0;
    for (const article of result.value) {
      if (seen.has(article.id)) continue;
      seen.add(article.id);
      articles.push(article);
      kept += 1;
    }
    statuses.push({ id: source.id, name: source.name, ok: true, count: kept });
  });

  dropRepeatedImages(articles);
  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { articles, statuses, window: { from, to } };
}
