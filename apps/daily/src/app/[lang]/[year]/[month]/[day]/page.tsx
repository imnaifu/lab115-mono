import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DigestView } from "@/components/DigestView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href as langHref, isLang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { alternatesFor, breadcrumb, JsonLd, ogCardFor, publisher } from "@/lib/seo";
import { displayTitle } from "@/components/ArticleTitle";
import { readDigest, shownArticles } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ lang: string; year: string; month: string; day: string }>;
};

/**
 * The date this URL names, reassembled from its three segments.
 *
 * The path is `/2026/08/14` and the store's key is `2026-08-14`, so exactly one
 * place should be joining them — this one. No validation here on purpose:
 * `readDigest` pattern-checks the result before it touches the filesystem, which
 * is the check that actually matters, and duplicating it would leave two
 * definitions of a valid date.
 */
function dateFrom(params: { year: string; month: string; day: string }): string {
  return `${params.year}-${params.month}-${params.day}`;
}

/**
 * A DAY is a page worth describing, and it had only a title.
 *
 * No canonical, no hreflang, no description and no og — so a link to a specific
 * day unfurled with the site-wide tagline and read as the home page. The headlines
 * are what makes it a different page from yesterday, so the headlines are the
 * description.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const resolved = await params;
  const { lang } = resolved;
  const date = dateFrom(resolved);
  // `[lang]` matches any segment, and this runs before the page's own check
  // rejects an unknown one — so fall back rather than throw on the title.
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const title = `${t.brand} · ${date}`;
  const path = dayPath(date);

  const digest = await readDigest(date);
  if (!digest) return { title, alternates: alternatesFor(pageLang, path) };

  /**
   * The first few headlines, which is the only honest summary of a day.
   *
   * Truncated at three rather than at a character count: a description cut
   * mid-headline reads as a bug, and three of these is already past the ~160
   * characters a result snippet shows.
   */
  // `shownArticles`, not `digest.articles`: the list also holds what was
  // considered and turned down, and those headlines are not what this day is.
  const description =
    shownArticles(digest)
      .slice(0, 3)
      .map((article) => displayTitle(article, pageLang))
      .join(" · ") || t.tagline;

  return {
    title,
    description,
    alternates: alternatesFor(pageLang, path),
    openGraph: {
      type: "website",
      title,
      description,
      // Through `langHref` like the canonical beside it, so the two always name
      // the same URL — an unfurler stores og:url as the link's identity.
      url: `${SITE}${langHref(pageLang, path)}`,
      siteName: t.brand,
      /**
       * THIS DAY'S CARD, drawn from these headlines — see `/og/[lang]/[name]`.
       *
       * Named by DATE rather than by page path: the cards live in their own
       * namespace now, so this is `/og/zh/2026-08-14.png` and not the page's URL
       * with `/og.png` stapled to it. See `ogUrl` in lib/links.
       *
       * The layout declares one for the home page, but declaring `openGraph` here
       * at all replaces that whole object rather than extending it (Next merges
       * metadata per top-level field), which is why this page unfurled with no
       * image whatsoever despite the layout above it having one.
       */
      images: ogCardFor(pageLang, date),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogCardFor(pageLang, date).map((image) => image.url),
    },
  };
}

export default async function DayPage({ params }: Params) {
  const resolved = await params;
  const { lang } = resolved;
  const date = dateFrom(resolved);
  if (!isLang(lang)) notFound();

  // readDigest validates the yyyy-mm-dd shape, so crafted date segments cannot
  // walk out of the repo directory.
  const digest = await readDigest(date);
  if (!digest) notFound();
  // The published half of the list — see `shownArticles`. The JSON-LD below
  // describes what a reader can actually open.
  const shown = shownArticles(digest);

  return (
    <>
      {/**
       * The day, as a list a crawler can read.
       *
       * `CollectionPage` says what this page is and `ItemList` says what is on it,
       * in the ranked order the page itself uses — which is the one thing the
       * markup cannot express, since every card is the same `<article>` shape. It
       * costs nothing at render and it is how a list page becomes eligible for a
       * result that shows more than its title.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          // Through `langHref`, like the canonical, so the two never disagree
          // about which URL this object describes.
          "@id": `${SITE}${langHref(lang, dayPath(date))}`,
          name: `${strings(lang).brand} · ${date}`,
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          datePublished: date,
          /**
           * THE SAME DAY, stated anyway.
           *
           * A digest is written once, on the day it is for, and never edited — so
           * this is not a guess, it is the fact. Saying it matters because the
           * absence of `dateModified` is not read as "never modified": a crawler
           * deciding how often to come back for a site that publishes daily has to
           * fall back to guessing from the fetch, and an explicit stamp equal to
           * `datePublished` is what tells it this page is finished.
           */
          dateModified: date,
          publisher: publisher(strings(lang).brand),
          /**
           * The trail, because the URL cannot carry it. See `breadcrumb` in
           * lib/seo — a day is one level down from the home page, and this is what
           * puts 每日干货 › 2026-08-23 in a search result instead of a bare path.
           */
          breadcrumb: breadcrumb([
            {
              name: strings(lang).brand,
              url: `${SITE}${langHref(lang, "/")}`,
            },
            { name: date, url: `${SITE}${langHref(lang, dayPath(date))}` },
          ]),
          mainEntity: {
            "@type": "ItemList",
            // The published ones only. An unpublished article has no page, so
            // listing it here is a structured-data claim about a 404.
            numberOfItems: shown.length,
            itemListElement: shown.map((article, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE}${langHref(lang, articlePath(date, article))}`,
              name: displayTitle(article, lang),
            })),
          },
        }}
      />
      <DigestView digest={digest} lang={lang} />
    </>
  );
}
