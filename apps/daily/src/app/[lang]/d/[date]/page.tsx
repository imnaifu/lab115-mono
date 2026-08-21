import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DigestView } from "@/components/DigestView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href as langHref, isLang } from "@/lib/lang";
import { articlePath } from "@/lib/links";
import { alternatesFor, JsonLd, publisher } from "@/lib/seo";
import { displayTitle } from "@/components/ArticleTitle";
import { readDigest } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; date: string }> };

/**
 * A DAY is a page worth describing, and it had only a title.
 *
 * No canonical, no hreflang, no description and no og — so a link to a specific
 * day unfurled with the site-wide tagline and read as the home page. The headlines
 * are what makes it a different page from yesterday, so the headlines are the
 * description.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, date } = await params;
  // `[lang]` matches any segment, and this runs before the page's own check
  // rejects an unknown one — so fall back rather than throw on the title.
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const title = `${t.brand} · ${date}`;
  const path = `/d/${date}`;

  const digest = await readDigest(date);
  if (!digest) return { title, alternates: alternatesFor(pageLang, path) };

  /**
   * The first few headlines, which is the only honest summary of a day.
   *
   * Truncated at three rather than at a character count: a description cut
   * mid-headline reads as a bug, and three of these is already past the ~160
   * characters a result snippet shows.
   */
  const description =
    digest.articles
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
      url: `${SITE}${path}`,
      siteName: t.brand,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function DayPage({ params }: Params) {
  const { lang, date } = await params;
  if (!isLang(lang)) notFound();

  // readDigest validates the yyyy-mm-dd shape, so a crafted [date] cannot walk
  // out of the repo directory.
  const digest = await readDigest(date);
  if (!digest) notFound();

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
          // LANGUAGE-PREFIXED, like the canonical. The unprefixed form is the one
          // the proxy redirects, so an @id built from it names a 307 rather than
          // the page it is describing.
          "@id": `${SITE}${langHref(lang, `/d/${date}`)}`,
          name: `${strings(lang).brand} · ${date}`,
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          datePublished: date,
          publisher: publisher(strings(lang).brand),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: digest.articles.length,
            itemListElement: digest.articles.map((article, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE}${langHref(lang, articlePath(date, article.id))}`,
              name: displayTitle(article, lang),
            })),
          },
        }}
      />
      <DigestView digest={digest} lang={lang} path={`/d/${date}`} />
    </>
  );
}
