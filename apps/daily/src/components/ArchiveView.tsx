import { notFound } from "next/navigation";
import { DayList } from "./DayList";
import { PageShell } from "./PageShell";
import { Footer, Masthead, PAD, SECTION } from "./Shell";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import {
  archiveMonths,
  archiveMonthSlice,
  archivePath,
  monthOf,
} from "@/lib/paging";
import { archiveDocTitle, breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { listDates } from "@/lib/store";

/**
 * `/archive` and `/archive/2026-08` — the run of editions, ONE MONTH AT A TIME.
 *
 * IT WAS PAGINATED, thirty dates to a page, `/archive/2` and up. See the note in
 * lib/paging for why a month replaced a page number: position in a list is a
 * fact about the list's length rather than about the archive, and it changes
 * under a reader every time a digest lands.
 *
 * ONE COMPONENT FOR BOTH ROUTES, which is the arrangement pagination had too:
 * `/archive` is the newest month and `/archive/<yyyy-mm>` is any of them, and
 * they differ by which key gets passed in. The newest month is NOT also
 * reachable at its dated URL from inside this site — the month row links to
 * `/archive` for it — so one page has one address, which is the rule the old
 * `/archive/1` redirect existed for.
 */
export async function ArchiveView({
  lang,
  month,
}: {
  lang: Lang;
  /** Which month to show, or nothing for the newest. */
  month?: string;
}) {
  const t = strings(lang);
  const dates = await listDates();
  const months = archiveMonths(dates);

  /**
   * AN EMPTY ARCHIVE IS A 404, not an empty page.
   *
   * `hasArchive` used to guard this — the archive 404'd until the site held more
   * days than the front page showed, because below that threshold it was the
   * front page's own list a second time. The front page shows five pieces of ONE
   * day now, so there is no overlap left to protect against and the only state
   * worth refusing is having nothing at all.
   */
  if (!months.length) notFound();

  const shownMonth = month ?? months[0].month;
  const inMonth = archiveMonthSlice(dates, shownMonth);
  if (!inMonth.length) notFound();

  /* The newest month lives at the bare `/archive`; every other one at its own
     key. One page, one URL — see the note on `archivePath`. */
  const isNewest = shownMonth === months[0].month;
  const path = archivePath(isNewest ? undefined : shownMonth);
  const url = `${SITE}${href(lang, path)}`;

  const [year, monthNo] = shownMonth.split("-").map(Number);
  const live = new Set(months.map((m) => m.month));
  /* Newest year first, and only the years that have something in them. */
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];

  return (
    <PageShell lang={lang} path={path}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: archiveDocTitle(t.brand, t.archiveTitle, shownMonth),
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.archiveTitle, url },
          ]),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: inMonth.length,
            itemListElement: inMonth.map((date, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE}${href(lang, dayPath(date))}`,
              name: date,
            })),
          },
        }}
      />

      <Masthead title={t.archiveHeading} lead={t.archiveLead} />

      {/**
       * THE YEAR ROW, and it renders only when there is a choice to make.
       *
       * One year of archive is one tab, which is a control that cannot be
       * operated — it is a label wearing a button's clothes. The site has held
       * exactly one year so far, so today this block draws nothing at all and
       * appears on its own the January after it stops being true.
       *
       * A year is NOT its own URL. Pressing one goes to that year's newest
       * month, because a year page would be a list of up to twelve links and
       * nothing else — the doorway shape `TOPIC_MIN_ARTICLES` exists to keep
       * this site away from.
       */}
      {/* ONE GROUP, `gap-3` INSIDE IT, and no top margin on the group itself.
          The year row and the month grid were two `SECTION` blocks, which put
          32px between two rows of the same control and another 32px on top of
          the masthead's own padding — three gaps of the same size where there
          is one heading, one picker and one list. The picker is now a single
          object under the heading. */}
      <div className={`${PAD} flex flex-col gap-3`}>
        {years.length > 1 ? (
          <nav className="flex flex-wrap gap-2">
            {years.map((y) => {
              const newestOfYear = months.find((m) => m.month.startsWith(y))!;
              const current = y === String(year);
              return (
                <a
                  key={y}
                  href={href(
                    lang,
                    archivePath(
                      newestOfYear.month === months[0].month
                        ? undefined
                        : newestOfYear.month,
                    ),
                  )}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-button px-4 py-1.5 text-sm font-bold transition duration-150 ease-out ${
                    current
                      ? "bg-ink text-paper"
                      : "border border-line text-ink-mid hover:border-ink-soft hover:text-ink"
                  }`}
                >
                  {y}
                </a>
              );
            })}
          </nav>
        ) : null}

        {/**
         * TWELVE CELLS, ALWAYS — and the empty ones are text rather than links.
         *
         * Drawing only the months that exist would make the grid change shape
         * every time the site publishes into a new one, and a reader who has
         * learned where 9月 sits would have to find it again. Twelve is what a year
         * is; the ones this site was not publishing in say so by being flat.
         *
         * `aria-disabled` rather than a `<button disabled>`: these are not
         * controls that failed, they are months with nothing in them, and the
         * markup should read as a list of months of which some are links.
         */}
        <nav className="grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const key = `${year}-${String(m).padStart(2, "0")}`;
            const has = live.has(key);
            const current = key === shownMonth;
            if (!has) {
              return (
                <span
                  key={m}
                  aria-disabled
                  className="rounded-xl border border-line/60 px-2 py-2 text-center text-sm font-bold text-ink-soft/45"
                >
                  {t.monthShort(m)}
                </span>
              );
            }
            return (
              <a
                key={m}
                href={href(
                  lang,
                  archivePath(key === months[0].month ? undefined : key),
                )}
                aria-current={current ? "page" : undefined}
                className={`rounded-xl px-2 py-2 text-center text-sm font-bold transition duration-150 ease-out ${
                  current
                    ? "bg-ink text-paper"
                    : "border border-line text-ink-mid hover:border-ink-soft hover:text-ink active:opacity-80"
                }`}
              >
                {t.monthShort(m)}
              </a>
            );
          })}
        </nav>
      </div>

      {/* `pb-2` RATHER THAN A `SECTION` BETWEEN THIS AND THE ROWS. A heading
          and the list it heads are one block: `DayList` used to add `mt-8` of
          its own under this, so the month's name floated equidistant between
          the picker above and its own dates below and belonged to neither. */}
      <section className={`${SECTION} ${PAD} pb-2`}>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          {t.monthTitle(year, monthNo)}
        </h2>
      </section>

      {/* `DayList` is the same component the front page used for its run of
          days — a date, a count and that day's lead headline per row. The lead
          headline is what makes these rows worth reading rather than a column of
          digits; see the note there. */}
      <DayList dates={inMonth} lang={lang} from="archive" />

      <Footer year={dates[0]?.slice(0, 4) ?? String(year)} lang={lang} />
    </PageShell>
  );
}

/** Re-exported so the routes can build a canonical without importing two
 *  modules for one path. */
export { monthOf };
