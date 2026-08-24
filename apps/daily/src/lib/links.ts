import type { Article } from "./types";
import type { Lang } from "./lang";

/**
 * URL shapes, kept apart from `store.ts` because these are needed in the
 * BROWSER and store.ts imports `node:fs`. A client component pulling in the
 * filesystem module is a build error, and the only thing it wanted was a string
 * template.
 *
 * Both imports here are TYPE-ONLY and stay that way: they are erased at build,
 * so this module still pulls nothing into a browser bundle.
 */

/**
 * How much of an article id a share link carries.
 *
 * The id is a 40-character sha1, which is unreadable in a URL and worse printed
 * across the bottom of a share poster. Eight hex characters is 32 bits against
 * the ~20 articles in one day — the collision probability inside a single
 * digest is around 2e-8, and a collision would show the wrong article rather
 * than crash, so the shorter link is worth it.
 */
export const SHARE_ID_CHARS = 8;

/**
 * The short id: the last segment of an article's URL, and the DOM id its card
 * carries so the share dialog can scope a text selection to that one article.
 *
 * One identifier for both, so a reader comparing a shared link with a poster
 * filename sees the same eight characters. Note it can begin with a digit — legal
 * in HTML and fine for `getElementById`, but it must never be interpolated into a
 * raw CSS selector without escaping. Nothing does.
 */
export function articleAnchor(id: string): string {
  return id.slice(0, SHARE_ID_CHARS);
}

/** How long a slug may run before it is cut at a word boundary. */
const SLUG_MAX = 60;

/**
 * A headline, reduced to the part of it that belongs in a URL.
 *
 * ASCII only, deliberately. Every source this site reads publishes in English, so
 * the original headline is the one string on an article that is reliably
 * Latin-script — and a percent-encoded Chinese slug is forty bytes of `%E6%AF%8F`
 * in the one place a URL is supposed to be readable. A title with no Latin
 * characters at all reduces to the empty string, which `articleSlug` handles by
 * falling back to the bare id.
 *
 * Cut at a `-` rather than at `SLUG_MAX` exactly: a slug ending mid-word reads as
 * a truncation bug, and losing one word costs nothing.
 */
export function slugify(title: string): string {
  const flattened = title
    .toLowerCase()
    // Curly quotes and the like vanish rather than becoming separators: "don't"
    // should be `dont`, not `don-t`.
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (flattened.length <= SLUG_MAX) return flattened;
  const cut = flattened.slice(0, SLUG_MAX);
  const lastBreak = cut.lastIndexOf("-");
  return (lastBreak > 0 ? cut.slice(0, lastBreak) : cut).replace(/-+$/, "");
}

/**
 * The last segment of an article's URL: the headline, then its id.
 *
 * BOTH HALVES EARN THEIR PLACE. The slug is what the URL says — this used to be
 * eight hex characters and nothing else, which meant the URL line of a search
 * result carried no information whatsoever and the breadcrumb markup in lib/seo
 * existed largely to compensate for it. The id is what the URL MEANS: lookup goes
 * by id, so the slug can change — a re-run, an edited headline — without breaking
 * a link anyone saved.
 *
 * The same slug serves both languages. The Chinese page shows `titleZh` in its
 * heading, but the URL is not a heading: what a reader searches for, in either
 * language, is the original English headline of an English technical article.
 * Keeping one slug also keeps `articlePath` language-independent, which is what
 * lets `href` wrap it rather than the other way round.
 */
export function articleSlug(article: Article): string {
  const anchor = articleAnchor(article.id);
  const slug = slugify(article.title);
  return slug ? `${slug}-${anchor}` : anchor;
}

/**
 * The id at the end of a slug, or null if there is not one there.
 *
 * EXACTLY `SHARE_ID_CHARS`, never a range, and that is not fussiness: hex digits
 * are also letters, so a range would read the tail of `...-cache-added` as the id
 * `added` and look up an article that does not exist. Requiring the full width
 * makes a false positive an eight-letter word spelled entirely from `a-f`, and
 * `readArticleBySlug` tries an exact slug match before it ever gets here.
 */
export function idFromSlug(slug: string): string | null {
  const found = new RegExp(`(?:^|-)([0-9a-f]{${SHARE_ID_CHARS}})$`).exec(slug);
  return found ? found[1] : null;
}

/**
 * One day's page, e.g. `/2026/08/14`.
 *
 * HIERARCHICAL, and it used to be a flat `/d/2026-08-14`. Two things went with
 * that change: the `/d/` segment, which was namespacing the date space against
 * nothing — no other route ever sat beside it — and the flatness, which made
 * `/2026/08` and `/2026` unreachable. Those two are NOT built yet and this is the
 * note that says why: with a few days on the site a year page would list exactly
 * what `/archive` lists, which is the duplicate-canonical problem this whole
 * change is fixing, self-inflicted. The path shape is the durable half and it is
 * settled now; the index pages come when `/archive` grows past one screen.
 *
 * A four-digit first segment can never collide with a named page, so nothing is
 * fenced off by giving the dates the top level.
 */
export function dayPath(date: string): string {
  return `/${date.split("-").join("/")}`;
}

/**
 * The single-article page, e.g. `/2026/08/14/why-async-rust-is-hard-ff36a72e`.
 *
 * What gets shared, and where the poster is rendered from. There was briefly an
 * `articleHash` beside this returning `/d/<date>#<anchor>` — the day's list with a
 * fragment — and it is worth recording why it went: a fragment never reaches the
 * server, so a crawler fetching that URL cannot know which article was meant and
 * the link preview loses the poster. A shared link that shows nothing is a worse
 * trade than one that opens a single-article page.
 *
 * Takes the ARTICLE now rather than an id, because the slug needs the headline.
 * Every call site already had one in hand.
 */
export function articlePath(date: string, article: Article): string {
  return `${dayPath(date)}/${articleSlug(article)}`;
}

/**
 * A link-preview card: `/og/zh/site.png`, or `/og/zh/2026-08-14.png` for a day.
 *
 * OUTSIDE THE PAGE TREE, where these used to live as `/<lang>/og.png` and
 * `/<lang>/d/<date>/og.png`. Two reasons, and the second is the load-bearing one.
 *
 * A page path and an asset path sharing a namespace is a collision waiting for a
 * slug to walk into it — harmless while every article was eight hex characters,
 * not harmless now that the last segment is arbitrary text.
 *
 * And `proxy.ts` skips anything ending in a file extension, so a language-prefixed
 * image route could never be reached through the unprefixed form the site now
 * serves Chinese at. Carrying the language as an ordinary path segment sidesteps
 * that entirely: these routes never touch the language proxy, and the matcher
 * there keeps the simple "a dot means a file" rule it has always had.
 */
export function ogUrl(lang: Lang, name: string): string {
  return `/og/${lang}/${name}.png`;
}

/**
 * The base of one article's share posters — `/share/zh/2026-08-14/ff36a72e`.
 *
 * WITHOUT the part or the extension: `posterPartUrl` adds those. The two are split
 * because the share sheet holds one base and asks for several images off it.
 */
export function posterBase(lang: Lang, date: string, id: string): string {
  return `/share/${lang}/${date}/${articleAnchor(id)}`;
}

/**
 * Which image of a share this poster is: 1 is the identity card, 2 and up are
 * pages of prose. See `posterPages` in lib/share.ts for where the count comes
 * from.
 *
 * THESE TWO LIVE HERE, not beside the geometry they describe, for the same reason
 * everything else in this file does: the share sheet is a client component and it
 * needs to build these URLs. lib/share.ts carries the font fetcher, the inlined
 * brand mark and the whole layout table — none of which has any business in a
 * browser bundle.
 */
export function posterPart(value: string | null): number {
  // `1.png` — the part is a path segment now, not a `?part=`. Stripping the
  // extension here rather than in the route keeps the two halves of this
  // convention, the one that writes the URL and the one that reads it, together.
  const part = Number(String(value ?? "").replace(/\.png$/, ""));
  // Anything unparseable is the first image, which is the one a caller that knows
  // nothing about parts — a crawler, an old link — should get.
  return Number.isInteger(part) && part >= 1 ? part : 1;
}

/**
 * One image of a share. `base` is `posterBase` above, or an absolute form of it.
 *
 * A PATH SEGMENT, where this used to append `?part=`. The query string was the
 * thing that forced `robots.ts` to carry a `share.png?*` disallow pattern and the
 * share sheet's retry to append `&retry=` — a `&` that was only correct because a
 * `?` was already guaranteed to be there. Neither is true now: part 1 and part 4
 * are ordinary distinct URLs, and a retry appends its own `?`.
 */
export function posterPartUrl(base: string, part: number): string {
  return `${base}/${Math.max(1, part)}.png`;
}

