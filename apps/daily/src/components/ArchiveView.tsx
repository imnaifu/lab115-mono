import { notFound } from "next/navigation";
import { DayList } from "./DayList";
import { PageShell } from "./PageShell";
import { Breadcrumb, Footer, Masthead, MastheadDot, PAD } from "./Shell";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { archivePages, archivePath, archiveSlice, hasArchive } from "@/lib/paging";
import { archiveDocTitle, breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { listDates } from "@/lib/store";

/**
 * One page of the archive — the full run of dates, thirty at a time.
 *
 * ONE COMPONENT FOR BOTH ROUTES. `/archive` is page 1 and `/archive/<n>` is the
 * rest; they differ by a number, so they are not two files. Page 1 is deliberately
 * NOT reachable as `/archive/1` — that route redirects here — because two URLs for
 * one page is the smallest version of the problem this site spent a while removing.
 */
export async function ArchiveView({ lang, page }: { lang: Lang; page: number }) {
  const t = strings(lang);
  const dates = await listDates();
  const total = archivePages(dates.length);

  /**
   * A page number past the end is a 404, not an empty list.
   *
   * `hasArchive` is part of the same check: below the threshold the front page is
   * already showing every date, so this page would be that list a second time.
   * Nothing links here in that state and the sitemap leaves it out — a 404 is the
   * honest answer for a URL that has no content of its own yet.
   */
  if (!hasArchive(dates.length) || page < 1 || page > total) notFound();

  const shown = archiveSlice(dates, page);
  const url = `${SITE}${href(lang, archivePath(page))}`;

  return (
    <PageShell lang={lang} path={archivePath(page)}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: archiveDocTitle(t.brand, t.archiveTitle, page),
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.archiveTitle, url: `${SITE}${href(lang, archivePath(page))}` },
          ]),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: shown.length,
            itemListElement: shown.map((date, i) => ({
              "@type": "ListItem",
              // Continuing the run rather than restarting at 1 on every page: the
              // position is where the day sits in the archive, which is the thing
              // the number is for.
              position: (page - 1) * shown.length + i + 1,
              url: `${SITE}${href(lang, dayPath(date))}`,
              name: date,
            })),
          },
        }}
      />

      {/* 归档 IS THE TITLE AGAIN, and the round trip is worth recording because
          both moves were right when they were made.

          It started here. Then it moved down into the meta row, because a
          heading reading 归档 where every other page on the site read 每日严选
          made this the one page whose lockup was not the site's — the meta row
          being where the other pages said WHICH page this was. That reasoning
          held for exactly as long as the heading was the brand. The lockup is in
          the bar now (see SiteHeader), so the heading is free to name the page,
          and this is the page whose name it is. The document title made the same
          trip: see `archiveDocTitle`. */}
      <Masthead
        title={t.archiveTitle}
        /* The trail replaces the way home that used to sit at the BOTTOM of this
           page — see the note where that block was. It also takes 归档 back out of
           the meta row below, where it landed one round earlier: the crumb says
           which page this is, and says it as a place in the site rather than as a
           label, so the word twice in one header is once too many. */
        crumb={
          <Breadcrumb
            label={t.breadcrumb}
            items={[
              { label: t.home, href: href(lang, "/") },
              { label: t.archiveTitle },
            ]}
          />
        }
      >
        <span>{t.days(dates.length)}</span>
        {total > 1 ? (
          <>
            <MastheadDot />
            <span>{t.pageOf(page, total)}</span>
          </>
        ) : null}
      </Masthead>

      <DayList dates={shown} lang={lang} from="archive" />

      {/**
       * The pager. Plain links, both directions, and only the ones that exist.
       *
       * NO `rel="prev"/"next"`: Google stopped using them for pagination years ago
       * and says so, and they were never read by anything else here. What a crawler
       * needs is an ordinary crawlable `<a href>` per page, which is what these are.
       *
       * Each page is self-canonical. A canonical pointing every page at `/archive`
       * is the common mistake and it hides pages 2 and up from the index entirely —
       * which for this site is most of the archive.
       */}
      {total > 1 ? (
        <nav className={`${PAD} mt-8 flex items-center justify-between gap-3`}>
          {page > 1 ? (
            <a
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid"
              href={href(lang, archivePath(page - 1))}
              data-track="archive_open"
              data-track-from="pager"
            >
              ← {t.newer}
            </a>
          ) : (
            <span />
          )}
          {page < total ? (
            <a
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid"
              href={href(lang, archivePath(page + 1))}
              data-track="archive_open"
              data-track-from="pager"
            >
              {t.older} →
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}


      {/* NO WAY-ONWARD CARD HERE, and the other three lists all have one. It was
          `每日严选 / 过滤信息噪音…` pointing at `/`, which read as a brand banner
          rather than as a way back, and it was the THIRD link home on this page —
          the lockup is one, and the breadcrumb at the top is now the other, named
          and in the place a reader looks for it. `track="home_open"` from
          `trackFrom="archive"` goes with it; the crumb is not tracked, because
          "did anyone leave the archive upwards" is not a question worth an event
          on a page whose whole job is to be passed through. */}

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
