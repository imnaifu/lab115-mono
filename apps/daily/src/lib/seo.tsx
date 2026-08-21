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
