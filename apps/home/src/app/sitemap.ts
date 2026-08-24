import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { LANGS } from "@/lib/lang";

/**
 * One entry per language. The bare `/` is left out deliberately: it only ever
 * redirects, so listing it would point crawlers at a URL that is never a page.
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
    url: `${SITE}/${lang}`,
    lastModified: built,
    changeFrequency: "monthly" as const,
    priority: 1,
    alternates: {
      languages: Object.fromEntries(
        LANGS.map((code) => [code, `${SITE}/${code}`]),
      ),
    },
  }));
}
