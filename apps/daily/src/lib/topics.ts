import type { Metadata } from "next";
import {
  CATEGORIES,
  categoryName,
  categoryOf,
  CATEGORY_BY_ID,
  type Category,
} from "./categories";
import { SITE } from "./config";
import { strings } from "./i18n";
import { href, type Lang } from "./lang";
import { TOPIC_PATH, topicPath } from "./links";
import { alternatesFor, ogCardFor } from "./seo";
import { archiveIndex, type SourceArticle } from "./store";

/**
 * TOPIC PAGES: one stable URL per subject, holding every take this site has
 * written in it.
 *
 * WHY THEY EXIST AT ALL. Everything else here is addressed by DATE — the front
 * page is today, `/2026/09/05` is one edition, the archive is a list of them —
 * and a date is the one thing nobody searches for. So the whole archive is
 * reachable only by walking back through it, every URL on the site ages out of
 * relevance the morning after it is written, and there is no page that
 * accumulates anything. A topic page is the opposite shape: its URL never
 * changes, it gets longer every week, and it is what a person actually types.
 *
 * THE SUBJECT IS THE CATEGORY, not a tag. `Article.category` is assigned per
 * article by the summariser against the boundaries written in config.json (see
 * `Category.hint`), so it is an editorial judgement over the whole archive with
 * exactly one value per article. `SummaryText.tags` was the alternative and it
 * is not one: the prompt stopped asking for it, 35 of 96 archived takes carry
 * any, and they were written for a 小红书 share note rather than as a subject
 * index — building URLs out of them would be inventing a taxonomy out of
 * whatever three words a model happened to emit on a Tuesday.
 *
 * NO TOPIC IS EVER INVENTED. The list is `CATEGORIES`, which is config.json, and
 * an article whose stored category has since been renamed away resolves to the
 * catch-all through `categoryOf` — the same rule every other renderer uses. A
 * page is never created because a string appeared in the data.
 */

/**
 * How many published takes a topic needs before it gets a page of its own.
 *
 * THE SAME SHAPE AND THE SAME NUMBER AS `SOURCE_MIN_ARTICLES` IN LIB/SOURCES,
 * deliberately: below it a topic page is a heading, a generated sentence and one
 * or two rows — which is thin by any definition, and eight of those is a doorway
 * set. This site is a daily pile of summaries of other people's writing, close
 * enough to what Google's scaled-content policy describes that thin pages are a
 * risk it should not take for free.
 *
 * IT BITES TODAY, which is the point of measuring rather than assuming. Over the
 * first 30 days the archive holds tech 104, culture 76, science 64, economy 38,
 * business 25, living 20, investing 19 — and design ONE. So `/topic/design`
 * 404s, is not in the sitemap, and is not named in the sibling row, until a
 * third design piece publishes. A page that does not exist yet is the honest
 * answer, and it arrives on its own.
 *
 * IT GATES THREE THINGS AT ONCE, stated once here: the route (404), the sitemap
 * (not listed), and the links (an article in a quiet topic shows no topic link,
 * and the sibling row leaves it out). A URL that is listed but 404s, or linked
 * but not listed, is the disagreement `hasArchive` exists to prevent one route
 * over.
 */
export const TOPIC_MIN_ARTICLES = 3;

/** Whether a topic with this many published takes has a page. Every caller asks
 *  through here rather than comparing the number — see the note above. */
export function hasTopicPage(published: number): boolean {
  return published >= TOPIC_MIN_ARTICLES;
}

/**
 * Takes per topic page.
 *
 * THIRTY, which is `ARCHIVE_PAGE_SIZE`. Not because the two lists are the same —
 * one holds dates and one holds headlines — but because a reader who has seen
 * the archive's pager has learned how long a page of this site is, and a second
 * answer to that would be a second thing to learn. Thirty rows of date + headline
 * + one sentence is also about the point where a page stops being scannable.
 */
export const TOPIC_PAGE_SIZE = 30;

/** How many pages a topic of this size runs to. At least one, so a live topic
 *  always has a page 1 even when it holds fewer than a full page. */
export function topicPages(total: number): number {
  return Math.max(1, Math.ceil(total / TOPIC_PAGE_SIZE));
}

/** The takes on one page. `page` is 1-based. */
export function topicSlice(
  articles: SourceArticle[],
  page: number,
): SourceArticle[] {
  const from = (page - 1) * TOPIC_PAGE_SIZE;
  return articles.slice(from, from + TOPIC_PAGE_SIZE);
}

/**
 * Every published take, grouped by the topic page it belongs to — newest day
 * first, and within a day in the order the digest ranked them.
 *
 * KEYED BY THE LIVE CATEGORY ID, which is what makes this different from reading
 * `archiveIndex().byTopic` directly: that map is keyed by the raw string stored
 * on the article, and the archive holds ids that config.json no longer defines.
 * `categoryOf` is the rule for those — it resolves to the catch-all, exactly as
 * a card or the JSON-LD's `articleSection` does — so folding it in here is what
 * keeps a topic page showing the same set of articles the rest of the site
 * already agrees belongs to that category. Reading the raw map would instead
 * give `/topic/culture` everything that literally says `culture` while a retired
 * id quietly had no page at all.
 *
 * NOT CACHED ON ITS OWN. `archiveIndex` is, and this is a regroup of the list it
 * hands back — a few hundred pushes against a hundred file reads.
 */
export async function articlesByTopic(): Promise<Map<string, SourceArticle[]>> {
  const { all } = await archiveIndex();
  const byTopic = new Map<string, SourceArticle[]>();

  for (const entry of all) {
    const id = categoryOf(entry.article.category).id;
    const run = byTopic.get(id);
    if (run) run.push(entry);
    else byTopic.set(id, [entry]);
  }

  return byTopic;
}

/**
 * Does THIS article's topic have a page to link to?
 *
 * THE ONE QUESTION EVERY LINK TO A TOPIC HAS TO ASK, given the threshold is
 * real and currently excludes one category. Asked here, with an article rather
 * than an id, because that is how every caller has it: a card, a meta row, a
 * related row. It folds in `categoryOf` too, so a stored id that config.json no
 * longer defines is judged on the category it actually resolves to.
 *
 * It returns the CATEGORY as well as the verdict, because a caller that gets
 * `true` immediately needs the name and the accent, and looking those up again
 * is a second chance to resolve the id differently. `null` means "no link".
 *
 * CHEAP TO CALL PER CARD. `articlesByTopic` is a regroup of the cached archive
 * index — no file is read — so fifteen calls on a day page cost fifteen map
 * lookups over one shared walk.
 */
export async function topicLinkFor(
  article: { category: string },
): Promise<Category | null> {
  const category = categoryOf(article.category);
  const articles = (await articlesByTopic()).get(category.id) ?? [];
  return hasTopicPage(articles.length) ? category : null;
}

/** One topic, as a page knows it: the category and its whole run of takes. */
export interface Topic {
  category: Category;
  articles: SourceArticle[];
}

/**
 * The topics that HAVE a page, in config.json's own order.
 *
 * CONFIG ORDER, not by size. The order in that file is the running order the
 * site has always used for sections, and sorting by count instead would make the
 * sibling row on every topic page reshuffle itself as the archive grows — a
 * navigation whose items move is one a returning reader has to re-read.
 *
 * DRIVEN BY `CATEGORIES` RATHER THAN BY THE IDS THE ARCHIVE TURNED UP, which is
 * the same loop written the other way round and is the mistake the sitemap
 * already made once with sources: a category removed from config.json would
 * otherwise get a page that `categoryOf` cannot name. Driving from config makes
 * "every topic page has a category behind it" true by construction.
 */
export async function liveTopics(): Promise<Topic[]> {
  const byTopic = await articlesByTopic();
  return CATEGORIES.map((category) => ({
    category,
    articles: byTopic.get(category.id) ?? [],
  })).filter((topic) => hasTopicPage(topic.articles.length));
}

/** How many topic names the hub's `<title>` lists before 「等」. See below. */
const HUB_TITLE_NAMES = 4;

/**
 * The hub's `<head>` — `/topic`.
 *
 * ITS DESCRIPTION NAMES THE LIVE TOPICS rather than describing the page in the
 * abstract ("browse our topics"). A result snippet for this URL is competing
 * with every other "topics" page on the internet, and the only thing that makes
 * this one worth opening is WHICH subjects are behind it — which is also the
 * one sentence that stays true as the site grows, because it is generated from
 * what actually cleared the threshold.
 *
 * NO PAGINATION AND NO NUMBER IN THE TITLE: there are eight rows at most and
 * there will not be many more, since a topic is a category in config.json
 * rather than a keyword.
 */
export async function topicHubMetadata(lang: Lang): Promise<Metadata> {
  const t = strings(lang);
  /**
   * FOUR NAMES AND THEN 「等」, not all of them.
   *
   * A `<title>` is cut at roughly 30 Chinese characters in a result, and eight
   * names plus the brand is past 40 — so listing them all buys nothing and
   * spends the visible half of the line on a list that gets truncated
   * mid-word. The English is worse: these names are phrases (`Economics &
   * Policy`, `Society & Ideas`), so eight of them is over 130 characters.
   *
   * Four is what fits before the cut in both languages while still doing the
   * job — which is proving there is something specific behind this URL rather
   * than a generic "topics" page. They come off `liveTopics`, so the four are
   * config.json's own running order and do not shuffle between renders.
   */
  const names = (await liveTopics())
    .slice(0, HUB_TITLE_NAMES)
    .map(({ category }) => categoryName(category, lang));

  const title = `${t.topicHubDocTitle(names)} · ${t.brand}`;
  const description = t.topicHubLead;
  const path = TOPIC_PATH;

  return {
    title,
    description,
    alternates: alternatesFor(lang, path),
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE}${href(lang, path)}`,
      siteName: t.brand,
      images: ogCardFor(lang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogCardFor(lang, "site").map((image) => image.url),
    },
  };
}

/**
 * One topic page's `<head>`, for BOTH routes that render one.
 *
 * ONE COPY, and the reason is written in lib/seo beside `archiveDocTitle`: the
 * archive had its title in three places and they had already drifted, so page 2
 * carried the number in `<title>` and not in `og:title` and a link to page 2
 * unfurled as page 1. Two routes render a topic — the bare path and the paged
 * one — and this is the whole of what they would otherwise each write out.
 *
 * THE THRESHOLD IS CHECKED HERE TOO, not only in the view. `generateMetadata`
 * runs for a request the page then 404s, and a not-found page carrying a real
 * title, a canonical and an og:url is a 404 advertising itself as a page. The
 * cost is that both halves walk the archive, which is one walk because
 * `archiveIndex` is cached across them.
 *
 * THE CARD IS THE SITE CARD. A per-topic OG image would be a fourth image route
 * drawing a word on a coloured ground, which is what the site card already is —
 * the same call the source page and the archive make, for the same reason.
 */
export async function topicMetadata(
  lang: Lang,
  id: string,
  page: number,
): Promise<Metadata> {
  const t = strings(lang);
  const category = CATEGORY_BY_ID.get(id);
  if (!category) return { title: `${t.notFoundTitle} · ${t.brand}` };

  const articles = (await articlesByTopic()).get(category.id) ?? [];
  if (!hasTopicPage(articles.length) || page < 1 || page > topicPages(articles.length)) {
    return { title: `${t.notFoundTitle} · ${t.brand}` };
  }

  const name = lang === "zh" ? category.name : category.nameEn;
  /* The subject leads and the brand is the suffix — the one other page on this
     site that does it this way round is a source page, for the same reason: the
     search this page has to win is the SUBJECT's, and `每日严选 · 技术` buries the
     word somebody typed behind a word they did not.

     THE PAGE NUMBER STAYS from 2 up, exactly as `archiveDocTitle` does it: four
     pages of a topic sharing one title is four search results a reader cannot
     tell apart. */
  const base = `${t.topicDocTitle(name)} · ${t.brand}`;
  const title = page > 1 ? `${base} · ${page}` : base;
  const description = t.topicLead(name);
  const path = topicPath(category.id, page);

  return {
    title,
    description,
    // SELF-CANONICAL PER PAGE, both languages — see `alternatesFor`. Pointing
    // every page at page 1 is the common mistake and it hides the rest of a long
    // topic from the index.
    alternates: alternatesFor(lang, path),
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE}${href(lang, path)}`,
      siteName: t.brand,
      images: ogCardFor(lang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogCardFor(lang, "site").map((image) => image.url),
    },
  };
}
