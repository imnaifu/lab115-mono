/**
 * The reader's language, carried in the URL.
 *
 * THE DEFAULT LANGUAGE IS UNPREFIXED and the other one is not: Chinese lives at
 * `/archive`, English at `/en/archive`. It used to be symmetric — `/zh/…` and
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
 * So there is no negotiating redirect anywhere on the site now. `/` is a page,
 * every URL is self-canonical, and there is no second address for Google to
 * prefer. `detectLang` below survives for the feed's sake and nothing else.
 *
 * THE COST, stated plainly: an English speaker who types the bare domain lands
 * on Chinese and has to use the language switch. That is the trade — any
 * server-side negotiation on `/` rebuilds the alias this removed.
 *
 * A route rather than client state or a cookie: every page here is
 * server-rendered anyway, so the language is just a prop. The HTML is right on
 * arrival, with no provider, no hydration step and nothing to keep in sync.
 */
export const LANGS = ["zh", "en"] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "zh";

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

/**
 * The bare path behind a language-prefixed one — the inverse of `href`.
 *
 * `proxy.ts` needs it to turn a legacy `/zh/archive` back into `/archive`, and
 * it lives here rather than there so the prefix rules are stated once.
 */
export function barePath(path: string): string {
  for (const lang of LANGS) {
    if (path === `/${lang}`) return "/";
    if (path.startsWith(`/${lang}/`)) return path.slice(lang.length + 1);
  }
  return path;
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
