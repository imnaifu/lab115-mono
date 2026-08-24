import { SITE } from "./config";
import { DEFAULT_LANG, href, LANGS, type Lang } from "./lang";
import { ogUrl } from "./links";

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
 * `name` is the CARD'S name, not a page path — `site` or a date — because the
 * cards live in their own `/og/<lang>/` namespace rather than hanging off the page
 * they belong to. See `ogUrl` in lib/links for why they moved out. Still one per
 * language: the headlines drawn on the card are in the language of the page.
 */
export function ogCardFor(lang: Lang, name: string) {
  return [{ url: `${SITE}${ogUrl(lang, name)}`, width: OG_WIDTH, height: OG_HEIGHT }];
}

/**
 * `alternates` for one page, in every language it exists in.
 *
 * WHY HREFLANG MATTERS HERE: every page of this site exists twice, unprefixed and
 * under `/en/…`, and without these tags a crawler sees two URLs it has to guess
 * about — usually by picking one and dropping the other. The tags say "these are
 * the same page for different readers", which is the difference between two
 * indexed versions and one indexed version plus a duplicate.
 *
 * `x-default` NAMES THE SAME URL AS `zh-CN`, and the previous version of this
 * comment argued for the opposite so it is worth being explicit about what was
 * wrong. It used to point at the unprefixed path on the reasoning that the proxy
 * negotiated it by Accept-Language, which made it "literally the
 * language-negotiating URL — exactly what x-default is defined to mean".
 *
 * The reasoning was sound and the outcome was a bug. Googlebot sends no
 * Accept-Language, so for the one crawler that matters the negotiation was not a
 * negotiation: `/archive` resolved to the Chinese page, every single time. This
 * tag then declared that address as a valid URL for the content — so Google had
 * two URLs, both nominated by the site, for one page. It clustered them and chose
 * the unprefixed one over the page's own `<link rel="canonical">`, which is
 * precisely what Search Console reported: "Duplicate, Google chose different
 * canonical than user", on three Chinese pages and no English one.
 *
 * There is no negotiating URL to name any more — the default language is
 * unprefixed and `/` is a real page (see lib/lang.ts) — so x-default points where
 * a reader who asked for nothing in particular actually lands. Pointing it at the
 * same URL as `zh-CN` is a documented configuration, not a workaround.
 */
export function alternatesFor(lang: Lang, path: string) {
  const languages: Record<string, string> = {
    "x-default": url(DEFAULT_LANG, path),
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
 * WHY THIS SITE ADDED IT: an article's URL used to be `/zh/d/2026-08-23/dc27b4ba`,
 * whose last segment is the first eight characters of a sha1 (see `articleAnchor`
 * in lib/links). The URL line of a search result therefore carried no information
 * at all, and breadcrumbs were what replaced it — Google draws the trail in place
 * of the path, so a result showed 每日干货 › 2026-08-23 rather than eight hex
 * digits.
 *
 * THAT IS NO LONGER THE JUSTIFICATION, and the trail stays anyway. The URL is
 * `/2026/08/23/why-async-rust-is-hard-dc27b4ba` now — see `articleSlug` in
 * lib/links — so the path carries the headline and the date on its own. What
 * breadcrumbs still do that a path cannot is name the levels: a crawler reading
 * `/2026/08/23` has to infer that this is a date and that the site's home page is
 * its parent, and this states both. Cheap, and it survived the thing it was
 * originally compensating for.
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
 * `@id` goes through `href` like every other URL here. On the Chinese side that is
 * now the bare `${SITE}/` — which is a real page rather than the redirect it used
 * to be, so the note that used to warn against naming it no longer applies.
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
