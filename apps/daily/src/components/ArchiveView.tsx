import { notFound } from "next/navigation";
import { DayList } from "./DayList";
import { EndLink, Footer, Masthead, PAD, PageShell } from "./Shell";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { archivePages, archivePath, archiveSlice, hasArchive } from "@/lib/paging";
import { breadcrumb, JsonLd, publisher } from "@/lib/seo";
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
    <PageShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: `${t.archiveTitle} · ${t.brand}`,
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

      <Masthead
        title={t.archiveTitle}
        subtitle={t.tagline}
        lang={lang}
        path={archivePath(page)}
      >
        <span>{t.days(dates.length)}</span>
        {total > 1 ? (
          <>
            <span className="size-1 rounded-full bg-orange" />
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

      <div className={PAD}>
        <EndLink
          href={href(lang, "/")}
          label={t.brand}
          sub={t.tagline}
          track="home_open"
          trackFrom="archive"
        />
      </div>

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
