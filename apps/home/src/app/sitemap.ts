import type { MetadataRoute } from "next";
import { LANGS } from "@/lib/lang";

const SITE_URL = "https://lab115.com";

/**
 * One entry per language. The bare `/` is left out deliberately: it only ever
 * redirects, so listing it would point crawlers at a URL that is never a page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return LANGS.map((lang) => ({
    url: `${SITE_URL}/${lang}`,
    changeFrequency: "monthly" as const,
    priority: 1,
    alternates: {
      languages: Object.fromEntries(
        LANGS.map((code) => [code, `${SITE_URL}/${code}`]),
      ),
    },
  }));
}
