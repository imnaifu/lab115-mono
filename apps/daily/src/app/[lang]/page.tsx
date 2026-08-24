import { notFound } from "next/navigation";
import { displayTitle } from "@/components/ArticleTitle";
import { DigestView, EmptyState } from "@/components/DigestView";
import { PageShell } from "@/components/Shell";
import { dateKey, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href as langHref, isLang } from "@/lib/lang";
import { articlePath } from "@/lib/links";
import { JsonLd, publisher, website } from "@/lib/seo";
import { readDigest, readLatest } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // `[lang]` matches any first segment, so an unknown one has to 404 rather
  // than render the site in a language that does not exist.
  if (!isLang(lang)) notFound();

  const today = dateKey(new Date());

  // Before the day's run has happened there is no file for `today` yet; fall
  // back to the newest digest on disk so the page is never blank.
  const digest = (await readDigest(today)) ?? (await readLatest());

  if (!digest) {
    return (
      <PageShell>
        <EmptyState lang={lang} />
      </PageShell>
    );
  }

  const t = strings(lang);
  const home = `${SITE}${langHref(lang, "/")}`;

  return (
    <>
      {/**
       * WHAT THIS SITE IS, declared at last on the page that most needs it.
       *
       * The day page has described itself as a `CollectionPage` and the article page
       * as a `BlogPosting` for a while; the home page — the most-linked URL on the
       * domain and the one a crawler reaches first — declared nothing at all, so
       * there was no object for the site's name, language or publisher to hang off.
       *
       * A `@graph` rather than one object, because there are genuinely two things
       * here and they are not nested: the SITE, which is what `@id` ends in `#site`
       * for so other pages can reference it, and TODAY'S LIST, which is a different
       * entity that happens to be what the site is currently showing. Flattening
       * them would mean claiming the site IS one day's list.
       *
       * `mainEntity` is the ranked order the page renders, the same way the day page
       * does it — the one thing the markup cannot express, since every card is the
       * same `<article>` shape.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            website(lang, t.brand, t.tagline),
            {
              "@type": "CollectionPage",
              "@id": home,
              url: home,
              name: t.brand,
              description: t.tagline,
              inLanguage: lang === "zh" ? "zh-CN" : "en-US",
              // The DIGEST'S date, not today's: before the day's run has happened
              // this page is showing the newest file on disk, and dating it today
              // would claim a freshness the content does not have.
              datePublished: digest.date,
              dateModified: digest.date,
              isPartOf: { "@id": `${home}#site` },
              publisher: publisher(t.brand),
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: digest.articles.length,
                itemListElement: digest.articles.map((article, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `${SITE}${langHref(lang, articlePath(digest.date, article.id))}`,
                  name: displayTitle(article, lang),
                })),
              },
            },
          ],
        }}
      />
      <DigestView digest={digest} lang={lang} path="/" />
    </>
  );
}
