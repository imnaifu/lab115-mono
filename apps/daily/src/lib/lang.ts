/**
 * The reader's language, carried in the URL.
 *
 * Both languages are prefixed — `/zh/…` and `/en/…` — and the bare paths are
 * redirected by middleware to whichever the request's Accept-Language asks for.
 * There is no unprefixed canonical page, so a URL always says what language it
 * is, and a link someone shares keeps the language they were reading.
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
 * A path in a given language. `path` is the bare form, e.g. `/d/2026-08-14`;
 * the root is just `/`.
 */
export function href(lang: Lang, path: string): string {
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
