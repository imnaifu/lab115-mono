import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { DEFAULT_LANG, href, LANGS } from "@/lib/lang";
import { articlePath, dayPath, SOURCES_PATH, sourcePath } from "@/lib/links";
import { hasSourcePage, SOURCE_PAGES_LIVE, SOURCES } from "@/lib/sources";
import { archivePages, archivePath } from "@/lib/paging";
import { listDates, readDigest, shownArticles } from "@/lib/store";

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
 * An hour, not a day: `SYNC_CRON` pulls every 15 minutes, so a fresh digest
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
  /**
   * Counted inside the loop below rather than by calling `articlesBySource`.
   *
   * That helper answers the same question and is cached — but this route already
   * opens every digest, so asking it here would be a SECOND full walk of the
   * archive in the one request where the cache is most likely to be cold (this
   * page revalidates hourly, the cache holds for ten minutes). Two maps built
   * from a loop that is already running cost nothing.
   *
   * `latest` takes the FIRST date a source is seen on, which is its newest,
   * because `dates` is newest-first.
   */
  const sourceCount = new Map<string, number>();
  const sourceLatest = new Map<string, string>();

  for (const date of dates) {
    pages.push(entry(dayPath(date), stamp(date)));
    const digest = await readDigest(date);
    // Published only: an article with no take has no page, and asking a crawler
    // to index one is asking it to index a 404.
    for (const article of digest ? shownArticles(digest) : []) {
      pages.push(entry(articlePath(date, article), stamp(date)));
      sourceCount.set(
        article.sourceId,
        (sourceCount.get(article.sourceId) ?? 0) + 1,
      );
      if (!sourceLatest.has(article.sourceId)) {
        sourceLatest.set(article.sourceId, date);
      }
    }
  }

  /**
   * The source directory, and every source that has a page.
   *
   * `hasSourcePage` IS THE SAME GATE THE ROUTE USES, read from the same constant —
   * which is the whole reason it is a function in lib/sources rather than a
   * comparison written twice. A sitemap entry for a source below the threshold
   * would be this file asking Google to index a URL the route 404s, which is the
   * disagreement `hasArchive` already exists to prevent one route over.
   *
   * A SOURCE'S `lastModified` IS ITS OWN NEWEST DAY, not the site's. A blog that
   * last appeared in June has not changed since June, and claiming otherwise
   * spends a crawl on every source page every time any digest lands — which for
   * twenty-five of them is the bulk of what this sitemap would be asking for.
   *
   * `/s` itself uses `newest`: its counts move whenever any digest lands.
   *
   * IT IS LISTED UNCONDITIONALLY, unlike the archive. `/s` is not a second view of
   * a list that lives somewhere else — nothing else on this site names the blogs
   * or carries their descriptions — so there is no state in which it duplicates
   * another page, and it still says something with every source below the
   * threshold.
   */
  /* Nothing from this section while it is hidden — see SOURCE_PAGES_LIVE. The
     per-source loop below needs no such guard: it asks `hasSourcePage`, which
     carries the flag, so listing and 404ing cannot come apart. This entry is the
     one that has no threshold to hang it on. */
  if (SOURCE_PAGES_LIVE) pages.push(entry(SOURCES_PATH, newest));
  /**
   * ITERATING `SOURCES` — the list in config.json — AND NOT THE IDS THE ARCHIVE
   * TURNED UP, which is the same loop written the other way round and is wrong.
   *
   * It shipped wrong for one build and the sitemap caught itself: `nngroup` has
   * three published takes in the archive and has since been REMOVED from
   * config.json, so counting ids out of the digests listed `/s/nngroup` while the
   * route 404s it (`SOURCE_BY_ID.get` finds nothing) and `/s` does not show it.
   * That is exactly the listed-but-404 disagreement the note above swears off,
   * arrived at from the one direction the threshold check cannot see.
   *
   * Driving the loop from config instead makes this sitemap a subset of what `/s`
   * renders BY CONSTRUCTION rather than by both sides agreeing — a source that is
   * not in config.json cannot be reached from here at all. The archive is still
   * where the COUNT comes from; it just no longer decides who is on the list.
   *
   * A retired source's articles keep their own pages either way. `sourceOf` falls
   * back to a placeholder so those still render — see the note there — and they
   * are listed above with the rest of their days. What goes away is the blog's
   * directory page, which is right: nothing links to it and it describes a
   * subscription that no longer exists.
   */
  for (const source of SOURCES) {
    const count = sourceCount.get(source.id) ?? 0;
    if (!hasSourcePage(count)) continue;
    pages.push(
      entry(
        sourcePath(source.id),
        stamp(sourceLatest.get(source.id) ?? dates[0]),
      ),
    );
  }

  return pages;
}
