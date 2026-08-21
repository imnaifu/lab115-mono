import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { href, LANGS } from "@/lib/lang";
import { articlePath } from "@/lib/links";
import { listDates, readDigest } from "@/lib/store";

/**
 * Every page of the site, in every language.
 *
 * THERE WAS NO SITEMAP, and this site is the shape that needs one most: the
 * content is an archive that only grows, and the only path to a three-week-old
 * article is archive → that day → that card. A crawler will get there eventually;
 * a sitemap is the difference between eventually and today, and it is also where
 * `lastModified` comes from, which is what stops a crawler re-fetching two months
 * of digests that have not changed.
 *
 * `alternates.languages` per entry rather than one entry per language pair: the
 * sitemap protocol's hreflang extension says the same thing the page's own tags
 * do — see `alternatesFor` in lib/seo — and saying it in both places is what makes
 * a crawler confident enough to act on it.
 */
export const dynamic = "force-dynamic";

/** The x-default target: the unprefixed path, which the proxy negotiates. */
function entry(path: string, lastModified: Date): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = { "x-default": `${SITE}${path}` };
  for (const lang of LANGS) {
    languages[lang === "zh" ? "zh-CN" : "en-US"] = `${SITE}${href(lang, path)}`;
  }
  return {
    // The default language's URL is the one listed; the rest hang off it.
    url: `${SITE}${href("zh", path)}`,
    lastModified,
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dates = await listDates();
  /**
   * A digest's date IS its last-modified time. They are written once, on the day
   * they are for, and never edited — so this is not an approximation of the truth,
   * it is the truth, and it means nothing here has to stat a file.
   */
  const stamp = (date: string) => new Date(`${date}T00:00:00Z`);
  // The newest digest is when the site as a whole last changed.
  const newest = dates.length ? stamp(dates[0]) : new Date(0);

  const pages: MetadataRoute.Sitemap = [
    entry("/", newest),
    entry("/archive", newest),
  ];

  /**
   * Every day, and every article inside it.
   *
   * The digests are read rather than inferred from the date list, because the
   * article ids only exist inside them. That is one file open per archived day on
   * a request a crawler makes rarely — the same thing the archive page already
   * does, and it is not on the reader's path.
   */
  for (const date of dates) {
    pages.push(entry(`/d/${date}`, stamp(date)));
    const digest = await readDigest(date);
    for (const article of digest?.articles ?? []) {
      pages.push(entry(articlePath(date, article.id), stamp(date)));
    }
  }

  return pages;
}
