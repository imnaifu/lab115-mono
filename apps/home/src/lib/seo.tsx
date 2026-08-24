import { SITE } from "./config";
import { PRODUCTS } from "@/data/products";
import { strings } from "./i18n";
import { href, type Lang } from "./lang";

/**
 * What this site tells a crawler about ITSELF, as opposed to what the page says
 * to a reader.
 *
 * THERE WAS NONE OF THIS. The metadata was in decent shape — a canonical, hreflang
 * for both languages, an x-default — but every one of those tags is about WHICH url
 * to index. Nothing said what the thing at that url IS: no publisher, no brand
 * entity, no statement that the two products described on the page are products.
 * For a two-URL site whose only realistic search demand is its own name, the brand
 * entity is close to the whole game, and it was the piece missing.
 *
 * Deliberately the same shapes apps/daily uses — see its lib/seo.tsx. The two sites
 * link to each other and both declare the same `Organization` `@id`, which is what
 * makes them one publisher with two properties rather than two unrelated domains.
 */

/**
 * A `<script type="application/ld+json">`, ready to drop into a page.
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
 * The lab, as a schema.org `Organization`.
 *
 * `@id` is `${SITE}/#org` — the SAME id apps/daily builds for its own publisher,
 * but rooted at this domain, which is the one that actually hosts the
 * organization. Referenced by `@id` from every other object here rather than
 * repeated inline, so a crawler reading both pages sees one publisher instead of
 * two that happen to match.
 *
 * `sameAs` carries the properties this brand owns. It is the machine-readable half
 * of the link in the product shelf, and the reason it is worth stating twice: a
 * link says "go here", `sameAs` says "that is also us".
 */
export function organization() {
  return {
    "@type": "Organization",
    "@id": `${SITE}/#org`,
    name: "LAB115",
    url: SITE,
    logo: `${SITE}/favicon.svg`,
    sameAs: PRODUCTS.map((product) => product.url),
  };
}

/** The site itself, per language. */
export function website(lang: Lang) {
  const text = strings(lang);
  const home = `${SITE}${href(lang, "/")}`;
  return {
    "@type": "WebSite",
    "@id": `${home}#site`,
    url: home,
    name: text.brand,
    description: text.metaDescription,
    inLanguage: lang === "zh" ? "zh-CN" : "en-US",
    publisher: { "@id": `${SITE}/#org` },
  };
}

/**
 * The shelf, as a list of things that exist.
 *
 * `SoftwareApplication` rather than `Product`, because that is what these are and
 * the type carries the two fields that make the difference in a result:
 * `applicationCategory` and `operatingSystem`. `offers` at price 0 is not padding
 * either — for software, a crawler treats the absence of an offer as unknown
 * rather than as free, and "free" is the single most useful fact about both of
 * these.
 *
 * The copy comes from data/products.ts. Nothing is written twice: the same strings
 * the cards render are the ones declared here, so a product whose description
 * changes cannot end up describing itself two ways.
 */
export function productList(lang: Lang) {
  return {
    "@type": "ItemList",
    numberOfItems: PRODUCTS.length,
    itemListElement: PRODUCTS.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: product.name,
        url: product.url,
        description: product.description[lang],
        // The Chrome extension runs in a browser; the digest IS a website. Read
        // off the url rather than stored, because it is a fact about where the
        // thing lives and that is what the url already says.
        applicationCategory: product.url.includes("chromewebstore")
          ? "BrowserApplication"
          : "WebApplication",
        operatingSystem: product.url.includes("chromewebstore")
          ? "Chrome"
          : "Any",
        inLanguage: ["zh-CN", "en-US"],
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
        publisher: { "@id": `${SITE}/#org` },
      },
    })),
  };
}

/**
 * The OG card's canvas, and the url of the route that draws it.
 *
 * 1200x630 is what every link unfurler crops to. Stating the dimensions beside
 * the url is not decoration: a crawler that has to fetch and decode the image
 * before it can lay out the card will, if it is in a hurry, render the text with
 * a blank frame instead.
 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export function ogCardFor(lang: Lang) {
  return [
    {
      url: `${SITE}/og/${lang}.png`,
      width: OG_WIDTH,
      height: OG_HEIGHT,
    },
  ];
}
