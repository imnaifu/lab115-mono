import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DayList } from "@/components/DayList";
import { PageShell } from "@/components/PageShell";
import { EndLink, Footer, Masthead, PAD } from "@/components/Shell";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { JsonLd, publisher, website } from "@/lib/seo";
import { FRONT_DAYS, hasArchive } from "@/lib/paging";
import { listDates } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

/**
 * THE FRONT PAGE IS THE NEWEST WEEK; every edition lives at its own dated URL and
 * `/archive` holds the full run.
 *
 * It rendered the newest digest IN FULL for most of this site's life, which made it
 * a byte-for-byte twin of that day's permalink — Google clustered the two, picked
 * one, and Search Console reported the other as a duplicate whose canonical it had
 * overridden. A directory has no twin: every summary exists at exactly one URL from
 * the hour it is written, nothing declares a canonical anywhere but at itself, and
 * nothing flips as the date rolls over.
 *
 * It is also what nearly every publication of this shape does — TLDR's root lists
 * its recent editions, JavaScript Weekly's root is a directory, and every Substack
 * and Ghost site lists posts and puts the prose behind them.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const dates = await listDates();

  /**
   * Only the description. NOT `openGraph` — Next merges metadata per top-level
   * field, so declaring one here would replace the layout's entire object rather
   * than extend it, and the layout's is already right for this URL: it is the home
   * page it was written for. The canonical and the hreflang set come from there too.
   */
  /* `recentDays`, matching the masthead — this said `t.days(dates.length)`, so a
     search snippet advertised 8 days over a page showing 7 and a label saying 7.
     `dates.length` when the site is younger than a week, which is what the page
     shows then too. */
  return {
    description: `${t.recentDays(Math.min(dates.length, FRONT_DAYS))} · ${t.tagline}`,
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // `[lang]` matches any first segment, so an unknown one has to 404 rather
  // than render the site in a language that does not exist.
  if (!isLang(lang)) notFound();
  const t = strings(lang);

  const dates = await listDates();
  const shown = dates.slice(0, FRONT_DAYS);
  const home = `${SITE}${href(lang, "/")}`;

  return (
    <PageShell lang={lang} path="/">
      {/**
       * The site, and the days it is currently showing.
       *
       * `ItemList` of DAYS, not of articles: the page renders days, and structured
       * data describing something the page does not show is the kind of mismatch a
       * crawler is entitled to distrust. The articles are described on the pages
       * that hold them.
       *
       * The list covers what is ON THIS PAGE — the newest week — rather than the
       * whole archive, for the same reason.
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
              isPartOf: { "@id": `${home}#site` },
              publisher: publisher(t.brand),
              ...(dates.length
                ? { datePublished: dates[dates.length - 1], dateModified: dates[0] }
                : {}),
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: shown.length,
                itemListElement: shown.map((date, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `${SITE}${href(lang, dayPath(date))}`,
                  name: date,
                })),
              },
            },
          ],
        }}
      />

      {/* THE RUN OF DAYS IS THE HEADING, promoted out of the meta row — this
          page is a directory of the newest week, and that sentence is the only
          thing on it that was ever page-specific. The brand it replaces says
          itself in the bar above, on this page and on every other.

          `shown`, not `dates` — what this page IS, not what the site holds. It
          read `t.days(dates.length)` until the eighth digest landed and the
          masthead said 8 over a list of 7. The total is now stated nowhere on
          this page, deliberately: `moreSub` used to carry it and no longer
          does. A reader who wants the run counts the archive.

          NO META ROW AND NO TRAIL. The row held this one string, and the front
          page is not part of anything. */}
      <Masthead title={t.recentDays(shown.length)} />

      <DayList dates={shown} lang={lang} from="home" />


      {/* Only once there is something the front page is not already showing —
          see `hasArchive`. With a week or less on the site this link would lead to
          the same list the reader is already looking at, and the sitemap holds the
          archive back on the same condition. */}
      {hasArchive(dates.length) ? (
        <div className={PAD}>
          <EndLink
            href={href(lang, "/archive")}
            label={t.more}
            sub={t.moreSub}
            track="archive_open"
            trackFrom="home"
          />
        </div>
      ) : null}

      {/* THE WAY IN TO `/s` WAS HERE — a second `EndLink`, under the archive's,
          answering "where does any of this come from". It is gone with the
          section itself; see SOURCE_PAGES_LIVE in lib/sources.

          WORTH KNOWING BEFORE PUTTING IT BACK: this card was for most of its life
          the ONLY internal link to `/s` anywhere on the site, which is what its
          old note gave as the reason it sat on the front page rather than in the
          footer — a section nothing links to is one a crawler reaches only
          through the sitemap. While the section is hidden that is moot, since the
          sitemap does not list it either. When it returns, it needs at least one
          real link again, here or in the bar. */}

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
