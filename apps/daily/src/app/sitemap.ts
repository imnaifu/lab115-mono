import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { DEFAULT_LANG, href, LANGS } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { archivePages, archivePath } from "@/lib/paging";
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

  const pages: MetadataRoute.Sitemap = [entry("/", newest)];

  /**
   * The archive, one entry per page — but only once it holds something the front
   * page is not already showing.
   *
   * `hasArchive` is the same condition the front page uses to decide whether to
   * LINK there, stated once in lib/paging. Below the threshold `/` lists every date
   * itself, so an archive entry here would be asking Google to index that list a
   * second time — which is the duplicate this site was reported for, rebuilt one
   * route over. The route 404s in that state for the same reason.
   *
   * Every page is listed, not just the first: they are self-canonical and each
   * holds dates the others do not, so leaving pages 2 and up out would hide most of
   * the archive from the index.
   */
  for (let page = 1; page <= archivePages(dates.length); page++) {
    pages.push(entry(archivePath(page), newest));
  }

  /**
   * Every day, and every article inside it — EXCEPT the day currently on the front
   * page, whose own entry is held back.
   *
   * That day's page names `/` as its canonical, because the home page renders the
   * full digest and the two would otherwise be one body at two URLs; see the note
   * in the day page's `generateMetadata`. Listing a URL here while it points its
   * canonical somewhere else is asking a crawler to spend a fetch on a page that
   * tells it to go elsewhere — a sitemap is a list of pages worth indexing, and for
   * one day that page is not one of them. It appears tomorrow, when the next digest
   * lands and it becomes self-canonical.
   *
   * ITS ARTICLES ARE STILL LISTED. They are not duplicates of anything: the front
   * page holds summaries, an article page holds one summary plus its cover, source
   * and poster, and no other URL carries that. Holding those back too would delay
   * the deepest and most numerous pages on the site for no reason at all.
   *
   * The digests are read rather than inferred from the date list, because the
   * article ids only exist inside them. That is one file open per archived day on
   * a request a crawler makes rarely — the same thing the home page's list of
   * days already does, and it is not on the reader's path.
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
