import { categoryOf } from "./categories";
import { SITE } from "./config";
import { strings } from "./i18n";
import { href, LANGS, type Lang } from "./lang";
import { articlePath } from "./links";
import { blocksOf } from "./paragraphs";
import { sourceOf } from "./sources";
import { listDates, readDigest } from "./store";
import { summaryFor } from "./take";
import type { Article, Digest } from "./types";

/**
 * The site's own Atom feed — the thing it asks of 69 other blogs and did not
 * publish itself.
 *
 * IT CARRIES THE WHOLE SUMMARY, not a teaser. Every other decision in this app
 * follows from "the take replaces reading the article", and a feed that shipped
 * a headline and a link would quietly reverse that: the reader would be back to
 * opening tabs, and the one place the writing was meant to be read would be the
 * one place it is missing. The cost is a bigger XML body, which is the cheapest
 * thing here.
 *
 * Atom rather than RSS 2.0, for three things this particular feed needs and RSS
 * has no proper slot for: a stable `<id>` per entry that is not the link, an
 * `<updated>` distinct from `<published>` (see `entryFor`), and `xml:lang` —
 * this is a bilingual site that treats /zh and /en as two publications, so the
 * feed has to say which one a reader is holding.
 */

/**
 * How much history a poll can miss and still lose nothing.
 *
 * The README states the rule this app applies to everyone ELSE'S feeds — `feed
 * 条数 ÷ 日产量 > 1 天` — and it applies here too, from the other side. A reader
 * that polls weekly (or a container that was down for a few days) has to find
 * every entry it has not seen, so the window is a week rather than a day, and
 * the entry cap is generous enough that a heavy week does not truncate it: ~20
 * articles on the busiest archived day, so 7 days can be ~140. 100 is the point
 * where the body stops being cheap; a reader that has been away longer than that
 * has the archive.
 */
const FEED_DAYS = 7;
const FEED_MAX_ENTRIES = 100;

/**
 * `&` FIRST, or every entity written by the later replacements gets its own
 * ampersand escaped a second time and `&amp;` ships as `&amp;amp;`. The apostrophe
 * is escaped as `&#39;` rather than `&apos;` because the latter is XML-only and
 * the readers that hand this markup to an HTML parser do not all know it.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** RFC 3339, or null if the stored stamp cannot be read as a date — an entry
 *  with an unparseable date is better published without one than dropped. */
function stamp(value: string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The headline in the feed's language, by the same rule `ArticleTitle` uses:
 *  the Chinese title is a translation that only /zh shows. */
function titleFor(article: Article, lang: Lang): string {
  const translated = lang === "zh" ? article.titleZh?.trim() : "";
  return translated || article.title;
}

/**
 * The entry body as HTML, in the shape the page draws: the lead under its
 * TL;DR label, the prose, then the way out to the original.
 *
 * Numbered blocks come back from `blocksOf` as headings and are drawn as `<h3>`
 * — the same reason `Summary` draws them heavier: they exist so a reader can
 * skip, and one styled as body copy cannot be skipped by.
 *
 * The markup is deliberately plain. A feed reader restyles everything anyway,
 * and the ones that do not are showing this in someone else's typography, so
 * anything clever here is at best ignored and at worst fought with.
 */
function contentHtml(article: Article, lang: Lang, url: string): string {
  const t = strings(lang);
  const summary = summaryFor(article, lang);
  const source = sourceOf(article.sourceId);

  const parts: string[] = [];
  if (summary.thesis) {
    parts.push(`<p><strong>TL;DR</strong> ${escapeXml(summary.thesis)}</p>`);
  }
  for (const block of blocksOf(summary.text ?? "")) {
    const text = escapeXml(block.text);
    parts.push(block.kind === "heading" ? `<h3>${text}</h3>` : `<p>${text}</p>`);
  }
  // The original, and who published it. This is the one link in the body that
  // leaves the site, and it belongs at the END: the summary is the point, and a
  // link above it is an invitation to skip the thing that was written for you.
  parts.push(
    `<p><a href="${escapeXml(article.url)}">${escapeXml(t.readFull)}</a>` +
      ` — ${escapeXml(source.name)}</p>`,
  );
  // Escaped once more as a whole, because this is `type="html"`: the element's
  // content is TEXT that happens to be markup, so the tags above have to arrive
  // as entities. CDATA would work too and is not used — a reader that strips it
  // wrongly gets raw markup on screen, and this failure mode is the quiet one.
  return escapeXml(parts.join(""));
}

function entryFor(article: Article, digest: Digest, lang: Lang): string {
  const path = articlePath(digest.date, article);
  const url = `${SITE}${href(lang, path)}`;
  const category = categoryOf(article.category);
  /**
   * `published` is the ORIGINAL article's date; `updated` is when this take was
   * written. They are genuinely different events and readers use them for
   * different things — sort order versus "is this new to me" — so a feed that
   * collapsed them into one would either bury a fresh take on an old post or
   * claim a two-year-old essay was published this morning.
   */
  const published = stamp(article.publishedAt);
  const updated = stamp(digest.generatedAt) ?? published;

  return [
    "  <entry>",
    `    <id>${escapeXml(url)}</id>`,
    `    <title type="text">${escapeXml(titleFor(article, lang))}</title>`,
    `    <link rel="alternate" type="text/html" href="${escapeXml(url)}"/>`,
    updated ? `    <updated>${updated}</updated>` : "",
    published ? `    <published>${published}</published>` : "",
    `    <category term="${escapeXml(category.id)}" label="${escapeXml(
      lang === "zh" ? category.name : category.nameEn,
    )}"/>`,
    `    <content type="html">${contentHtml(article, lang, url)}</content>`,
    "  </entry>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The feed for one language, as a complete XML document.
 *
 * Reads the same digests off disk that the pages read — there is no separate
 * store and no cache. A feed request costs a directory listing and up to seven
 * small JSON reads, which is less work than rendering the home page.
 */
export async function atomFeed(lang: Lang): Promise<string> {
  const t = strings(lang);
  const self = `${SITE}${href(lang, "/feed.xml")}`;
  const site = `${SITE}${href(lang, "/")}`;

  const dates = (await listDates()).slice(0, FEED_DAYS);
  const digests = (await Promise.all(dates.map(readDigest))).filter(
    (digest): digest is Digest => digest !== null,
  );

  const entries: string[] = [];
  for (const digest of digests) {
    for (const article of digest.articles) {
      if (entries.length >= FEED_MAX_ENTRIES) break;
      entries.push(entryFor(article, digest, lang));
    }
  }

  /**
   * The feed's own `updated`: the newest digest's generation time, not now.
   * `now` would change on every poll and tell a conditional reader that
   * something happened when nothing did.
   *
   * The epoch fallback is for an empty data directory — a fresh container that
   * has not run the job yet. An empty feed is a valid feed; a feed with no
   * `updated` is not.
   */
  const updated = stamp(digests[0]?.generatedAt) ?? new Date(0).toISOString();

  const links = LANGS.filter((other) => other !== lang).map(
    (other) =>
      `  <link rel="alternate" type="application/atom+xml" hreflang="${
        other === "zh" ? "zh-CN" : "en-US"
      }" href="${SITE}${href(other, "/feed.xml")}"/>`,
  );

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${
      lang === "zh" ? "zh-CN" : "en-US"
    }">`,
    `  <id>${self}</id>`,
    `  <title type="text">${escapeXml(t.brand)}</title>`,
    `  <subtitle type="text">${escapeXml(t.tagline)}</subtitle>`,
    `  <link rel="self" type="application/atom+xml" href="${self}"/>`,
    `  <link rel="alternate" type="text/html" href="${site}"/>`,
    ...links,
    `  <updated>${updated}</updated>`,
    `  <icon>${SITE}/icon-192.png</icon>`,
    `  <author><name>${escapeXml(t.brand)}</name><uri>${site}</uri></author>`,
    ...entries,
    "</feed>",
    "",
  ].join("\n");
}
