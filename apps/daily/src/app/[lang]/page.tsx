import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DayList } from "@/components/DayList";
import { EndLink, Footer, Masthead, PAD, PageShell } from "@/components/Shell";
import { Subscribe } from "@/components/Subscribe";
import { mailEnabled } from "@/lib/mail/resend";
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
  return { description: `${t.days(dates.length)} · ${t.tagline}` };
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
    <PageShell>
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

      <Masthead title={t.brand} subtitle={t.tagline} lang={lang} path="/">
        <span>{t.days(dates.length)}</span>
      </Masthead>

      <DayList dates={shown} lang={lang} from="home" />

      {mailEnabled() ? (
        <div className={PAD}>
          <Subscribe lang={lang} />
        </div>
      ) : null}

      {/* Only once there is something the front page is not already showing —
          see `hasArchive`. With a week or less on the site this link would lead to
          the same list the reader is already looking at, and the sitemap holds the
          archive back on the same condition. */}
      {hasArchive(dates.length) ? (
        <div className={PAD}>
          <EndLink
            href={href(lang, "/archive")}
            label={t.more}
            sub={t.moreSub(dates.length)}
            track="archive_open"
            trackFrom="home"
          />
        </div>
      ) : null}

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
