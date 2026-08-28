/**
 * The reader's language, carried in the URL.
 *
 * THE DEFAULT LANGUAGE IS UNPREFIXED and the other one is not: Chinese lives at
 * `/2026/08/24`, English at `/en/2026/08/24`. It used to be symmetric — `/zh/…` and
 * `/en/…`, with the bare path redirected by middleware to whatever the request's
 * Accept-Language asked for — and that symmetry cost more than it was worth.
 *
 * TWO THINGS WERE WRONG WITH IT, and they compound. The first is that the most
 * valuable URL on the domain, the bare `daily.lab115.com`, was never a page: it
 * was a 307. The second is what that redirect did to the index. Googlebot sends
 * no Accept-Language, so `detectLang` sent it to `/zh` — which made every
 * unprefixed URL a stable second address for the corresponding Chinese page, and
 * `alternatesFor` then NAMED those addresses in `x-default`. Google clustered
 * each pair and picked the unprefixed half as canonical, against the page's own
 * `<link rel="canonical">`. Search Console reported exactly the three Chinese
 * pages that had been crawled and no English one, which is the fingerprint of
 * this and not of anything else.
 *
 * So `/` is a page, every URL is self-canonical, and there is no second address
 * for Google to prefer. The prefixed Chinese form is not merely unused — it is a
 * 404 now, see proxy.ts — because a URL that still answers is a URL that can
 * still be indexed. `detectLang` below has no callers left.
 *
 * WHAT REPLACED THE NEGOTIATION IS A COOKIE, and the difference is the entire
 * point rather than an implementation detail. Accept-Language is sent by every
 * client including the crawler, which is how the bare URLs became aliases;
 * `LANG_COOKIE` below is sent only by a reader who has been here before, so a
 * crawler sees the plain Chinese `/` exactly as it does today and nothing
 * acquires a second address. See the note on the constant for what it does and,
 * more importantly, what it does not.
 *
 * THE COST, stated plainly: an English speaker typing the bare domain for the
 * FIRST time still lands on Chinese and has to use the language switch. Only the
 * second visit knows better. That is the trade — reading Accept-Language on `/`
 * would fix the first visit and rebuild the alias this removed.
 *
 * THE LANGUAGE ITSELF IS STILL A ROUTE, not client state — every page here is
 * server-rendered anyway, so the language is just a prop, and the HTML is right
 * on arrival with no provider, no hydration step and nothing to keep in sync.
 * The cookie does not change that. It never decides what a page renders; it only
 * decides which page the one address that names no language sends you to, and it
 * is read in `proxy.ts` before any page is reached.
 */
export const LANGS = ["zh", "en"] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "zh";

/**
 * WHERE A LANGUAGE CHOICE IS REMEMBERED, and it is deliberately a small promise.
 *
 * `proxy.ts` writes it from whatever URL the reader is actually on — landing on
 * `/en/…` records `en`, landing anywhere unprefixed records `zh` — so it holds
 * the language last READ, not the language last explicitly picked. That is the
 * wider of the two readings and the right one: someone who arrives on an English
 * article from a search result has said as much as someone who pressed the switch,
 * and a switch that only counts its own presses would ignore them.
 *
 * IT IS READ IN EXACTLY ONE PLACE AND AT EXACTLY ONE MOMENT: the bare `/`, and
 * only when the reader ARRIVES there — typed, bookmarked, followed in from
 * outside, launched as an app. No deeper path redirects, so every other URL on
 * the site answers in the language its own shape names and a link someone sends
 * you is still the page you get.
 *
 * FOLLOWING A LINK ON THE SITE IS NOT AN ARRIVAL, and that carve-out is not a
 * refinement — it is what keeps the language switch alive. On `/en` the switch
 * points at `/`, so a cookie that applied to in-site navigation would bounce the
 * reader back to the page they just left and the control would do nothing at all.
 * `proxy.ts` draws the line; see `fromInsideTheSite` there.
 *
 * A YEAR, because the answer does not go stale — someone who reads this in
 * English in August still does the following July — and because the cost of it
 * being wrong is one press of a control that is on every page.
 */
export const LANG_COOKIE = "lang";

/** A year, in seconds. See above. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLang(value: string | undefined): value is Lang {
  return value === "zh" || value === "en";
}

/**
 * A path in a given language. `path` is the bare form, e.g. `/2026/08/14`;
 * the root is just `/`.
 *
 * Asymmetric, and every URL on the site is built from here — see the note at the
 * top for why the default language carries no prefix. The asymmetry is confined
 * to these three lines precisely so that nothing else has to know about it.
 */
export function href(lang: Lang, path: string): string {
  if (lang === DEFAULT_LANG) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

export function otherLang(lang: Lang): Lang {
  return lang === "en" ? "zh" : "en";
}

/**
 * Pick a language from an Accept-Language header.
 *
 * Deliberately crude: this only has to answer "did they ask for Chinese?", and
 * a full q-value parser would be a lot of code for a two-value decision. Any
 * Chinese tag anywhere in the header wins, because someone whose browser lists
 * Chinese at all is likelier to want the Chinese half of a bilingual site;
 * everything else falls to English rather than to the default, since a reader
 * who never mentioned Chinese is exactly who the English side is for.
 */
export function detectLang(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return DEFAULT_LANG;
  return /\bzh\b|zh-/i.test(acceptLanguage) ? "zh" : "en";
}
