import { SITE } from "./config";
import { href, LANGS, type Lang } from "./lang";

/**
 * The metadata every page repeats: which URL is the canonical one, and where the
 * other language's copy of this page lives.
 *
 * IT IS THE SAME SHAPE ON EVERY PAGE, which is the reason it is a function. Four
 * routes were each writing their own `alternates` — three of them wrote none at
 * all — and a canonical that disagrees with the URL it is on is worse than no
 * canonical, so this is not a place for four independent attempts.
 */

/** The full URL of a bare path in one language. `path` is `/`, `/archive`, … */
function url(lang: Lang, path: string): string {
  return `${SITE}${href(lang, path)}`;
}


/**
 * The OG card's canvas: 1200x630, which is 1.91:1.
 *
 * NOT the poster's 1080x1440. The two images answer different questions and the
 * ratio is the whole difference: the poster is a 3:4 carousel card built to be
 * saved and swiped on a phone, and 1.91:1 is what every link unfurler crops to.
 * Hand a 3:4 image to a chat app's link preview and it either letterboxes it or
 * takes a band out of the middle — which on the poster is the middle of a
 * paragraph. So the article page keeps pointing at its poster (part 1 is already
 * a headline card and survives the crop), and every LIST page — the home page,
 * a day, the archive — gets a card drawn for this shape instead.
 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * The `images` entry for a page's own OG card, in the shape both `openGraph` and
 * `twitter` want.
 *
 * A function because the dimensions have to travel with the URL. Declaring the
 * URL alone makes a crawler fetch and decode the image before it can lay out the
 * card, and the ones that will not wait render the text with a blank frame.
 *
 * `path` is the bare page path — `/`, `/archive`, `/d/2026-08-14` — and the card
 * route is that path plus `/og.png`, per language, because the headlines drawn on
 * it are in the language of the page it belongs to.
 */
export function ogCardFor(lang: Lang, path: string) {
  const at = path === "/" ? "/og.png" : `${path}/og.png`;
  return [{ url: `${SITE}${href(lang, at)}`, width: OG_WIDTH, height: OG_HEIGHT }];
}

/**
 * `alternates` for one page, in every language it exists in.
 *
 * WHY HREFLANG MATTERS HERE: every page of this site exists twice, at `/zh/…` and
 * `/en/…`, and without these tags a crawler sees two URLs it has to guess about —
 * usually by picking one and dropping the other. The tags say "these are the same
 * page for different readers", which is the difference between two indexed
 * versions and one indexed version plus a duplicate.
 *
 * `x-default` points at the UNPREFIXED path, and that is not a shortcut: the proxy
 * redirects any path without a language prefix to whichever language the browser
 * asked for (see proxy.ts), so the unprefixed URL is literally the
 * language-negotiating one — exactly what x-default is defined to mean.
 */
export function alternatesFor(lang: Lang, path: string) {
  const languages: Record<string, string> = {
    "x-default": `${SITE}${path}`,
  };
  for (const other of LANGS) {
    languages[other === "zh" ? "zh-CN" : "en-US"] = url(other, path);
  }
  return { canonical: url(lang, path), languages };
}

/**
 * A `<script type="application/ld+json">`, ready to drop into a page.
 *
 * Structured data is the only way to tell a crawler what a page IS rather than
 * what words are on it — that this is one article's summary with a date and a
 * source, or that this is a list of today's twenty — and it is what rich results
 * are built from. The tags themselves are invisible.
 *
 * `dangerouslySetInnerHTML` is how a script's body gets into a React tree at all;
 * `JSON.stringify` cannot emit `<`, so there is nothing here to escape.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * The site itself, as a schema.org Organization.
 *
 * Referenced by `@id` from every other object rather than repeated inline, so a
 * crawler reading two pages sees one publisher rather than two that happen to
 * match.
 */
export function publisher(brand: string) {
  return {
    "@type": "Organization",
    "@id": `${SITE}/#org`,
    name: brand,
    url: SITE,
    logo: `${SITE}/icon-512.png`,
  };
}

/**
 * A `BreadcrumbList`, from the trail a page sits on.
 *
 * WHY THIS SITE NEEDS IT MORE THAN MOST: an article's URL is
 * `/zh/d/2026-08-23/dc27b4ba`, and that last segment is the first eight
 * characters of a sha1 (see `articleAnchor` in lib/links). It is unreadable by
 * design — the alternative was a slug built from a headline this site did not
 * write — but it means the URL line of a search result carries no information at
 * all. Breadcrumbs are what replace it: Google draws the trail in place of the
 * path, so a result for a two-week-old summary shows 每日干货 › 2026-08-23 rather
 * than eight hex digits.
 *
 * `items` is ordered from the root inward, and the LAST item is the page itself.
 * Its `item` URL is included rather than omitted: the schema allows dropping it
 * on the final crumb, but naming it costs nothing and keeps every entry the same
 * shape.
 */
export function breadcrumb(items: { name: string; url: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * The site itself, as a schema.org `WebSite`.
 *
 * The counterpart to `publisher` above: that one says who publishes, this one says
 * what the publication IS, and until now nothing declared it. The day and article
 * pages each described themselves — `CollectionPage`, `BlogPosting` — while the
 * home page, the most-linked URL on the domain, declared nothing whatsoever, so a
 * crawler had no object to attach the site's name, language or publisher to.
 *
 * `@id` is the LANGUAGE-PREFIXED home page for the same reason every canonical
 * here is: the bare `${SITE}/` is the URL the proxy redirects.
 */
export function website(lang: Lang, brand: string, tagline: string) {
  return {
    "@type": "WebSite",
    "@id": `${SITE}${href(lang, "/")}#site`,
    url: `${SITE}${href(lang, "/")}`,
    name: brand,
    description: tagline,
    inLanguage: lang === "zh" ? "zh-CN" : "en-US",
    publisher: publisher(brand),
  };
}
