import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { BODY_CHAR_LIMIT, WINDOW_HOURS } from "./config";
import { SOURCES, type Source } from "./sources";
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
 */
function decodeEntities(input: string): string {
  return input.replace(
    /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g,
    (match, dec: string, hex: string, name: string) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED_ENTITIES[name] ?? match;
    },
  );
}

function stripHtml(html: string): string {
  const withoutTags = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/**
 * Reading time. CJK has no spaces, so word-splitting alone would report ~0
 * minutes for a Chinese article — count CJK codepoints separately at 400/min
 * and everything else at 230 wpm.
 */
function readingMinutes(plain: string): number {
  const cjk = (plain.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const words = plain.replace(/[㐀-鿿豈-﫿]/g, " ").split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 230));
}

/** First <img src> in the entry body, used when the feed has no enclosure. */
function firstImage(html: string): string | null {
  const m = html.match(/<img\b[^>]*?\bsrc=["']([^"']+)["']/i);
  const src = m?.[1];
  return src && /^https?:\/\//i.test(src) ? src : null;
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
async function fetchBody(url: string): Promise<string> {
  const html = await get(url, "text/html");
  const scoped =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html;
  return stripHtml(scoped);
}

async function fetchSource(
  source: Source,
  from: Date,
  to: Date,
): Promise<RawArticle[]> {
  const xml = await get(source.feed, "application/rss+xml, application/xml");
  const doc = parser.parse(xml) as Record<string, any>;

  // RSS 2.0 nests items under rss.channel; Atom puts entries at feed level.
  const nodes: Record<string, unknown>[] =
    doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.channel?.item ?? [];

  const parsed = nodes
    .map((node) => normalize(node, source))
    .filter((a): a is NonNullable<typeof a> => a !== null)
    // No cross-day dedup state by design — the publication window *is* the
    // filter, so a run only ever sees the last WINDOW_HOURS of each feed.
    .filter((a) => {
      const at = new Date(a.publishedAt).getTime();
      return at >= from.getTime() && at < to.getTime();
    });

  return Promise.all(
    parsed.map(async ({ bodyHtml, ...rest }) => {
      let plain = stripHtml(bodyHtml);
      if (source.fetchBody || plain.length < SHORT_BODY_CHARS) {
        // A failed body fetch must not lose the article — keep what we had.
        try {
          plain = await fetchBody(rest.url);
        } catch {
          /* keep the feed-provided text */
        }
      }
      return {
        ...rest,
        readingMinutes: readingMinutes(plain),
        body: plain.slice(0, BODY_CHAR_LIMIT),
      };
    }),
  );
}

export interface FetchResult {
  articles: RawArticle[];
  statuses: SourceStatus[];
  window: { from: Date; to: Date };
}

/**
 * Fetch every source for the window ending at `to`. Sources are independent:
 * one failing feed is recorded in `statuses` and the rest still ship.
 */
export async function fetchAll(to: Date): Promise<FetchResult> {
  const from = new Date(to.getTime() - WINDOW_HOURS * 3600_000);

  const settled = await Promise.allSettled(
    SOURCES.map((s) => fetchSource(s, from, to)),
  );

  const statuses: SourceStatus[] = [];
  const seen = new Set<string>();
  const articles: RawArticle[] = [];

  settled.forEach((result, i) => {
    const source = SOURCES[i];
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

  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { articles, statuses, window: { from, to } };
}
