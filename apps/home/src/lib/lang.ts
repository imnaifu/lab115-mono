/**
 * The reader's language, carried in the URL.
 *
 * Both languages are prefixed — `/zh` and `/en` — and the bare path is
 * redirected by the proxy to whichever the request's Accept-Language asks for.
 * There is no unprefixed canonical page, so a URL always says what language it
 * is, and a shared link keeps the language the sharer was reading.
 *
 * Same contract as apps/daily, deliberately: the two sites link to each other,
 * and a reader who switches to English on one should not land back in Chinese
 * on the other.
 */
export const LANGS = ["zh", "en"] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "zh";

export function isLang(value: string | undefined): value is Lang {
  return value === "zh" || value === "en";
}

/** A path in a given language. `path` is the bare form; the root is just `/`. */
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
 * a full q-value parser would be a lot of code for a two-value decision.
 */
export function detectLang(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return DEFAULT_LANG;
  return /\bzh\b|zh-/i.test(acceptLanguage) ? "zh" : "en";
}
