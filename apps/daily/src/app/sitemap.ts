import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { DEFAULT_LANG, href, LANGS } from "@/lib/lang";
import {
  articlePath,
  dayPath,
  SOURCES_PATH,
  sourcePath,
  TOPIC_PATH,
  topicPath,
} from "@/lib/links";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { hasSourcePage, SOURCE_PAGES_LIVE, SOURCES } from "@/lib/sources";
import { archiveMonths, archivePath } from "@/lib/paging";
import { hasTopicPage, topicPages } from "@/lib/topics";
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
 * CACHED FOR AN HOUR IN THIS MODULE, and rendered per request — NOT `revalidate`.
 *
 * THE HOURLY CACHE IS RIGHT AND `revalidate` WAS THE WRONG MECHANISM FOR IT. The
 * loop below opens EVERY archived digest to collect the article ids, so a crawler
 * hitting this URL pays one file read per day the site has published and nothing
 * about the answer changes between one hit and the next. That reasoning stands.
 *
 * WHAT `revalidate = 3600` ALSO DID was make Next PRERENDER this route at BUILD
 * TIME — and the archive is a git clone the container makes when it STARTS, so at
 * build time `data/repo` is empty. The baked answer was the home page and nothing
 * else, with `lastmod` at the unix epoch because `dates[0]` was undefined, and it
 * was served with `x-nextjs-cache: HIT` for as long as the deployment lived.
 *
 * IT COST THE SITE ITS INDEX. Google was handed a sitemap declaring ONE url for a
 * site with ~320 of them, all stamped 1970 — and 234 article pages sat in Search
 * Console as "Crawled — currently not indexed". Nothing else was wrong with them:
 * canonical, hreflang and robots were all correct on the pages themselves.
 *
 * SO THE CACHE MOVED INTO THE MODULE, where it can only ever run at request time,
 * with the clone present. `force-dynamic` stops the build-time bake; the memo
 * below keeps the one-walk-per-hour that ISR was there to buy.
 *
 * An hour, not a day: `SYNC_CRON` pulls every 15 minutes, so a fresh digest should
 * appear within the hour rather than the next morning.
 */
export const dynamic = "force-dynamic";

/** How long one walk of the archive is reused. See the note above. */
const SITEMAP_TTL_MS = 60 * 60_000;

/**
 * The last answer and when it was built.
 *
 * MODULE STATE, which is per-process and lost on restart — both fine here. A
 * restart re-clones the archive anyway, so a cold cache after one is correct, and
 * there is exactly one long-running server.
 */
let cached: { at: number; map: MetadataRoute.Sitemap } | null = null;

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
  if (cached && Date.now() - cached.at < SITEMAP_TTL_MS) return cached.map;
  const map = await buildSitemap();
  cached = { at: Date.now(), map };
  return map;
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
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
   * The archive, ONE ENTRY PER MONTH — and the bare `/archive` is NOT one of
   * them.
   *
   * IT WAS ONE ENTRY PER PAGE, `/archive`, `/archive/2` and so on, with a note
   * about holding the whole thing back until it showed something the front page
   * did not. Two things changed. The front page shows five pieces of one day
   * now, so there is no overlap left to guard against; and the archive is
   * browsed by month, so its URLs are `/archive/2026-08` — see lib/paging.
   *
   * THE BARE `/archive` IS LEFT OUT ON PURPOSE. It is the NEWEST month, which
   * means the content behind it moves on the first of every morning of every
   * month: listing it would be asking a crawler to keep re-fetching an address
   * whose meaning is "whatever is current", while the same editions already have
   * a dated URL that never moves. The month pages are the durable half and they
   * are what is listed.
   *
   * EXCEPT the newest month's own dated URL, which 308s to `/archive` — one page,
   * one address — so it is skipped too. That month's DAYS are all listed below
   * regardless, so nothing in it is unreachable from here.
   *
   * `lastModified` IS THE MONTH'S OWN NEWEST DAY, not the site's: a month that
   * ended in August has not changed since August, and stamping it with today
   * would spend a crawl on every month every time any digest lands.
   */
  const months = archiveMonths(dates);
  for (const { month } of months.slice(1)) {
    const newestInMonth = dates.find((date) => date.startsWith(month))!;
    pages.push(entry(archivePath(month), stamp(newestInMonth)));
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

  /**
   * The same two maps keyed by TOPIC, filled in the same pass and for the same
   * reason: this route already opens every digest, so asking `articlesByTopic`
   * would be a second full walk of the archive in the one request where the
   * cache is most likely to be cold.
   *
   * COUNTED THROUGH `categoryOf`, not off the raw string. The archive holds
   * category ids that config.json no longer defines, and those resolve to the
   * catch-all everywhere a reader can see them — including on the topic page
   * itself, which reads `articlesByTopic` and normalises the same way. Counting
   * the raw value here would let this file and that page disagree about which
   * topics clear the threshold, which is the listed-but-404 disagreement the
   * source loop below already has a paragraph about.
   */
  const topicCount = new Map<string, number>();
  const topicLatest = new Map<string, string>();

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

      const topic = categoryOf(article.category).id;
      topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1);
      // `dates` is newest-first, so the first sighting is the topic's newest.
      if (!topicLatest.has(topic)) topicLatest.set(topic, date);
    }
  }

  /**
   * Every topic that has a page, and every page of it.
   *
   * `hasTopicPage` IS THE SAME GATE THE ROUTE USES, read from the same module —
   * the reason it is a function in lib/topics rather than a comparison written
   * twice. A sitemap entry for a topic below the threshold would be this file
   * asking Google to index a URL the route 404s.
   *
   * ITERATING `CATEGORIES`, NOT THE IDS THE ARCHIVE TURNED UP, which is the
   * mistake the source loop below records making once: a category removed from
   * config.json would otherwise be listed here while the route 404s it. Driving
   * the loop from config makes this a subset of what exists BY CONSTRUCTION.
   *
   * A TOPIC'S `lastModified` IS ITS OWN NEWEST DAY, not the site's. A subject
   * that last had a piece in June has not changed since June, and claiming
   * otherwise spends a crawl on all eight of them every time any digest lands.
   *
   * EVERY PAGE IS LISTED, not just the first: each is self-canonical and holds
   * takes the others do not, so leaving pages 2 and up out would hide most of a
   * long topic from the index — the same argument as the archive's pages above.
   */
  let anyTopic = false;
  for (const category of CATEGORIES) {
    const count = topicCount.get(category.id) ?? 0;
    if (!hasTopicPage(count)) continue;
    anyTopic = true;
    const stamped = stamp(topicLatest.get(category.id) ?? dates[0]);
    for (let page = 1; page <= topicPages(count); page++) {
      pages.push(entry(topicPath(category.id, page), stamped));
    }
  }

  /**
   * The hub, and ONLY once at least one topic has cleared the threshold.
   *
   * `anyTopic` is not a third way of asking the question — it is set by the
   * loop above, so the hub is listed exactly when there is a topic page to
   * list. On a young archive with every topic still quiet, `/topic` renders a
   * heading over no cards, and asking Google to index that is asking it to
   * index an empty state. The same shape as `hasArchive` two blocks up.
   *
   * `newest` rather than a topic's own day: the hub shows the two most recent
   * pieces in every section, so any digest landing changes it.
   */
  if (anyTopic) pages.push(entry(TOPIC_PATH, newest));

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
