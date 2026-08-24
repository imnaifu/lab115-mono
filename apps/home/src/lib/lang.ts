/**
 * The reader's language, carried in the URL.
 *
 * THE DEFAULT LANGUAGE IS UNPREFIXED and the other one is not: Chinese is `/`,
 * English is `/en`. Both used to be prefixed, with the bare path redirected by the
 * proxy to whatever Accept-Language asked for, and that arrangement had two faults
 * that compound.
 *
 * The first is that the most valuable URL here — the bare `lab115.com` — was never
 * a page, only a 307. The second is what the redirect did to the index: Googlebot
 * sends no Accept-Language, so `detectLang` sent it to `/zh` every time, making the
 * bare URL a stable second address for the Chinese page. `layout.tsx` then NAMED
 * that address in `x-default`. Google clustered the pair and chose the unprefixed
 * half as canonical over the page's own `<link rel="canonical">`, and Search
 * Console reported `lab115.com/zh` as "Duplicate, Google chose different canonical
 * than user".
 *
 * So there is no negotiating redirect here now. `/` is a page, every URL is
 * self-canonical, and nothing offers Google a second address to prefer.
 * `detectLang` below is kept but no longer decides where anyone lands.
 *
 * THE COST: an English speaker who types the bare domain gets Chinese and has to
 * use the switch in the nav. That is the trade — any server-side negotiation on
 * `/` rebuilds the alias this removes.
 *
 * Same contract as apps/daily, deliberately: the two sites link to each other, the
 * same report named pages on both, and they were fixed the same way.
 */
export const LANGS = ["zh", "en"] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "zh";

export function isLang(value: string | undefined): value is Lang {
  return value === "zh" || value === "en";
}

/**
 * A path in a given language. `path` is the bare form; the root is just `/`.
 *
 * Asymmetric — see the note at the top. Every URL on the site is built from here,
 * so the asymmetry is confined to these three lines.
 */
export function href(lang: Lang, path: string): string {
  if (lang === DEFAULT_LANG) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/**
 * The bare path behind a language-prefixed one — the inverse of `href`.
 *
 * `proxy.ts` needs it to turn a legacy `/zh` back into `/`, and it lives here so
 * the prefix rules are stated once.
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
 * a full q-value parser would be a lot of code for a two-value decision.
 */
export function detectLang(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return DEFAULT_LANG;
  return /\bzh\b|zh-/i.test(acceptLanguage) ? "zh" : "en";
}
