import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { DEFAULT_LANG, href, LANGS } from "@/lib/lang";

/**
 * One entry per language.
 *
 * The bare `/` used to be left out deliberately, "because it only ever redirects,
 * so listing it would point crawlers at a URL that is never a page". It is the
 * DEFAULT LANGUAGE'S page now rather than a redirect — see lib/lang.ts — so it is
 * in here, as the first entry, built through `href` like every other URL.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  /**
   * WHEN THIS SITE LAST CHANGED, which for a hand-written page is the build.
   *
   * There was no `lastModified` at all, which leaves a crawler nothing to decide
   * recrawl frequency from but its own history of fetching the url. The build time
   * is the honest answer here and it is not a trick: this page's content lives in
   * `lib/i18n.ts` and `data/products.ts`, so the only way any of it changes is a
   * deploy, and a deploy is when this module is evaluated.
   *
   * Read at module scope rather than inside the function, so every entry in one
   * sitemap carries the same stamp instead of a spread of microseconds.
   */
  const built = new Date();

  return LANGS.map((lang) => ({
    url: `${SITE}${href(lang, "/")}`,
    lastModified: built,
    changeFrequency: "monthly" as const,
    priority: 1,
    /**
     * `x-default` STATED HERE TOO, which it was not before.
     *
     * The page's own `<link rel="alternate">` set has carried one all along, and a
     * sitemap that lists a different set of alternates from the document is a
     * crawler being told two things. It is the same URL the page names — the
     * default language's, which is the unprefixed one; see the long note in
     * app/layout.tsx for why it is no longer the redirecting root.
     */
    alternates: {
      languages: {
        ...Object.fromEntries(
          LANGS.map((code) => [code, `${SITE}${href(code, "/")}`]),
        ),
        "x-default": `${SITE}${href(DEFAULT_LANG, "/")}`,
      },
    },
  }));
}
