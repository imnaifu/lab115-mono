import { notFound } from "next/navigation";
import { displayTitle } from "@/components/ArticleTitle";
import { EmptyState } from "@/components/DigestView";
import { FrontPage } from "@/components/FrontPage";
import { PageShell } from "@/components/Shell";
import { dateKey, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href as langHref, isLang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { JsonLd, publisher, website } from "@/lib/seo";
import { listDates, readDigest, readLatest } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

/**
 * How many days back the front page reaches before handing off to the archive.
 *
 * Six, so the block is a week's worth counting today. Long enough that a reader
 * who missed a couple of days can get back without a second page, short enough
 * that it stays a summary rather than becoming the archive with extra steps.
 */
const RECENT_DAYS = 6;

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

  /**
   * The days behind the one on show, with each day's lead headline.
   *
   * Sliced BY DATE rather than by position: `digest` is whatever is newest on
   * disk, and on a morning before the run it is yesterday's — so dropping
   * `dates[0]` would silently show the same day twice, once as the headline list
   * and once as the first row here.
   *
   * One file read per row, which is the same thing the archive page already does
   * and for the same reason: the lead headline only exists inside the digest.
   * Bounded at RECENT_DAYS, so this does not grow with the archive.
   */
  const dates = await listDates();
  const recent = (
    await Promise.all(
      dates
        .filter((date) => date < digest.date)
        .slice(0, RECENT_DAYS)
        .map(async (date) => {
          const day = await readDigest(date);
          const lead = day?.articles[0];
          return day && lead
            ? {
                date,
                lead: displayTitle(lead, lang),
                count: day.stats.shown,
              }
            : null;
        }),
    )
  ).filter((day) => day !== null);

  const t = strings(lang);
  const home = `${SITE}${langHref(lang, "/")}`;

  return (
    <>
      {/**
       * WHAT THIS SITE IS, declared on the page that most needs it.
       *
       * A `@graph` rather than one object, because there are genuinely two things
       * here and they are not nested: the SITE, which is what `@id` ends in `#site`
       * for so other pages can reference it, and TODAY'S LIST, which is a different
       * entity that happens to be what the site is currently showing. Flattening
       * them would mean claiming the site IS one day's list.
       *
       * `CollectionPage` and not `WebPage`, still: this page's subject is a set of
       * things, and `mainEntity` is the ranked order it renders them in — the one
       * thing the markup cannot express, since every row is the same shape.
       *
       * WHAT CHANGED WITH THE FRONT PAGE: `isPartOf` now names the DAY this list
       * came from. The page shows headlines and the summaries live at the dated
       * URL, so a crawler that reads this and then reads `/2026/08/24` should be
       * told the second is where the first points rather than left to work out
       * whether it has found a duplicate. It is the same relationship the "read the
       * whole day" link states in the markup, said in the vocabulary a crawler has.
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
              mainEntityOfPage: `${SITE}${langHref(lang, dayPath(digest.date))}`,
              publisher: publisher(t.brand),
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: digest.articles.length,
                itemListElement: digest.articles.map((article, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `${SITE}${langHref(lang, articlePath(digest.date, article))}`,
                  name: displayTitle(article, lang),
                })),
              },
            },
          ],
        }}
      />
      <FrontPage digest={digest} recent={recent} lang={lang} />
    </>
  );
}
