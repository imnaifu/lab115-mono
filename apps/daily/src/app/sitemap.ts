import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { DEFAULT_LANG, href, LANGS } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
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
/**
 * REVALIDATED HOURLY rather than rendered per request.
 *
 * This was `force-dynamic`, and of everything in the app it was the worst place
 * for it: the loop below opens EVERY archived digest to collect the article ids,
 * so a single crawler hitting this URL paid one file read per day the site has
 * ever published, and nothing about the answer changes between one hit and the
 * next. Google fetches a sitemap on its own schedule and often several times over
 * as the archive grows, so this was pure repeat cost.
 *
 * An hour, not a day: `DAILY_SYNC_CRON` pulls every 15 minutes, so a fresh digest
 * should appear in the sitemap within the hour rather than the next morning.
 *
 * Nothing else in the app changes — the READER'S pages stay `force-dynamic`,
 * because the cron rewrites those files underneath a long-running server and a
 * reader who pulls to refresh has to get today's digest, not a cached copy of it.
 * A crawler's index of URLs and a reader's page have genuinely different freshness
 * needs, and this is the one that can wait.
 */
export const revalidate = 3600;

/**
 * One page, in every language, as a sitemap entry.
 *
 * `x-default` NAMES THE DEFAULT LANGUAGE'S URL, and it used to name the
 * unprefixed path on the grounds that the proxy negotiated it. Those are the same
 * URL now — the default language is unprefixed — but the reasoning had to change
 * before the code could stay still: the unprefixed path was a 307 then, and
 * nominating a redirect here is half of what put three pages in Search Console as
 * duplicates with a Google-chosen canonical. See `alternatesFor` in lib/seo for
 * the full account; this file says the same thing in the sitemap's vocabulary and
 * the two must not drift.
 */
function entry(path: string, lastModified: Date): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {
    "x-default": `${SITE}${href(DEFAULT_LANG, path)}`,
  };
  for (const lang of LANGS) {
    languages[lang === "zh" ? "zh-CN" : "en-US"] = `${SITE}${href(lang, path)}`;
  }
  return {
    // The default language's URL is the one listed; the rest hang off it.
    url: `${SITE}${href(DEFAULT_LANG, path)}`,
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
   * INCLUDING TODAY'S, with nothing skipped and no notion of a "current" edition
   * to skip it by. That is worth stating because the obvious alternative was
   * considered and is now unnecessary: while the home page rendered the newest
   * digest verbatim, the newest day page was its duplicate, and keeping it out of
   * here until the day rolled over would have been the way to stop the two
   * competing. The front page carries headlines only now — see FrontPage.tsx — so
   * no day page has a twin at any moment, and every one of them is indexable from
   * the hour it is written rather than the morning after.
   *
   * The digests are read rather than inferred from the date list, because the
   * article ids only exist inside them. That is one file open per archived day on
   * a request a crawler makes rarely — the same thing the archive page already
   * does, and it is not on the reader's path.
   */
  for (const date of dates) {
    pages.push(entry(dayPath(date), stamp(date)));
    const digest = await readDigest(date);
    for (const article of digest?.articles ?? []) {
      pages.push(entry(articlePath(date, article), stamp(date)));
    }
  }

  return pages;
}
