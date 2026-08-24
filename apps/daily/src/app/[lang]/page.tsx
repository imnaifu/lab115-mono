import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { displayTitle } from "@/components/ArticleTitle";
import { Footer, Masthead, PAD, PageShell, SECTION } from "@/components/Shell";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { JsonLd, publisher, website } from "@/lib/seo";
import { listDates, readDigest } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

/**
 * THE FRONT PAGE IS A LIST OF DAYS, and every edition lives at its own dated URL.
 *
 * This is the third shape this page has had, so it is worth writing down what the
 * other two cost. It rendered the newest digest in full, which made it a byte-for-
 * byte twin of that day's permalink — Google clustered the two, picked one, and
 * Search Console reported the other as a duplicate whose canonical it had
 * overridden. Splitting the difference (full digest plus a few extra blocks) left
 * the twins 98.9% identical and needed a canonical tag on the day page to arbitrate
 * — a tag Google is free to disbelieve, which is exactly what it had already done
 * once.
 *
 * A directory has no twin. Every summary exists at exactly one URL, from the hour
 * it is written; nothing declares a canonical anywhere but at itself; nothing flips
 * as the date rolls over; and no day has to wait a day to become indexable. The
 * whole apparatus that the previous shape needed — a `featuredDate`, a conditional
 * canonical, a conditional sitemap entry — is gone rather than fixed.
 *
 * It is also what nearly every publication of this shape does: TLDR's root lists
 * its recent editions, JavaScript Weekly's root is a directory that redirects
 * `/latest` to a numbered issue, and every Substack and Ghost site lists posts and
 * puts the prose behind them.
 *
 * `/archive` USED TO BE THIS PAGE and now redirects here — see the note there. Two
 * URLs holding the same list of dates would have rebuilt, on the archive, the exact
 * problem this change removes from the home page.
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
   * page it was written for. The canonical and the hreflang set come from there
   * too, for the same reason.
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
  // One JSON per day, and this page is not on the screenshot path — the same
  // arrangement the archive used, since the lead headline only exists inside the
  // digest and there is no index file to read it from.
  const rows = await Promise.all(
    dates.map(async (date) => ({ date, digest: await readDigest(date) })),
  );

  const home = `${SITE}${href(lang, "/")}`;

  return (
    <PageShell>
      {/**
       * The site, and the list of days it is made of.
       *
       * `ItemList` of DAYS, not of articles. The page renders days, and structured
       * data that describes something the page does not show is the kind of
       * mismatch a crawler is entitled to distrust — the articles are described on
       * the pages that actually hold them.
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
                numberOfItems: rows.length,
                itemListElement: rows.map((row, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `${SITE}${href(lang, dayPath(row.date))}`,
                  name: row.date,
                })),
              },
            },
          ],
        }}
      />

      <Masthead title={t.brand} lang={lang} path="/">
        <span>{t.days(dates.length)}</span>
      </Masthead>

      <section className={`${SECTION} flex flex-col gap-2.5 ${PAD}`}>
        {rows.length === 0 ? (
          <div className="rounded-card bg-cream-deep px-5 py-4">
            {t.nothingYet}
          </div>
        ) : (
          rows.map(({ date, digest }, at) => (
            <a
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper px-5 py-4"
              key={date}
              href={href(lang, dayPath(date))}
              /* `age` rather than the date itself: which day was opened is not the
                 question — how far back readers actually reach is, and that is what
                 says whether the archive is a product or a formality. */
              data-track="day_open"
              data-track-from="home"
              data-track-age={at}
            >
              <span className="flex items-center justify-between gap-3.5">
                <span className="text-lg font-bold text-ink">{date}</span>
                <span className="text-sm font-bold whitespace-nowrap text-ink-soft">
                  {digest ? t.sectionCount(digest.stats.shown) : "—"}
                </span>
              </span>
              {/**
               * THE DAY'S LEAD HEADLINE, and it is not decoration.
               *
               * A row of `2026-08-23 · 5 篇` gives a reader nothing to choose
               * between. It is also the one thing on this page that differs between
               * the two languages — without it, `/` and `/en` are the same list of
               * digits four label strings apart, which is a translation pair Google
               * is free to disbelieve and collapse. `rows` already holds every
               * digest, so it costs no extra read.
               */}
              {digest?.articles[0] ? (
                <span className="line-clamp-1 text-sm text-ink-mid">
                  {displayTitle(digest.articles[0], lang)}
                </span>
              ) : null}
            </a>
          ))
        )}
      </section>

      <Footer year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())} lang={lang} />
    </PageShell>
  );
}
