import { displayTitle } from "./ArticleTitle";
import { PAD, SECTION } from "./Shell";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { readDigest } from "@/lib/store";

/**
 * A run of days, one row each: the date, how many pieces, and that day's lead
 * headline.
 *
 * ONE COMPONENT FOR TWO PAGES. The front page shows the newest few and the archive
 * shows all of them by the page — the difference is which dates get passed in, and
 * nothing else. They were briefly the same markup written twice, which is how two
 * lists that are supposed to be the same list start looking different.
 *
 * A SERVER COMPONENT that does its own reading. The lead headline only exists
 * inside the digest and there is no index file to get it from, so this is one file
 * open per row — the same cost the page paid before, just moved to where the rows
 * are built. Both callers pass a bounded slice, so it never grows with the archive.
 *
 * THE LEAD HEADLINE IS NOT DECORATION. A row of `2026-08-23 · 5 篇` gives a reader
 * nothing to choose between, and it is also the only thing on either page that
 * differs between the two languages — without it, `/` and `/en` are the same list
 * of digits a few label strings apart, which is a translation pair Google is free
 * to disbelieve and collapse into one.
 */
export async function DayList({
  dates,
  lang,
  from,
}: {
  dates: string[];
  lang: Lang;
  /** Which page the row was pressed on, for `day_open`. */
  from: string;
}) {
  const t = strings(lang);
  const rows = await Promise.all(
    dates.map(async (date) => ({ date, digest: await readDigest(date) })),
  );

  if (rows.length === 0) {
    return (
      <section className={`${SECTION} ${PAD}`}>
        <div className="rounded-card bg-cream-deep px-5 py-4">{t.nothingYet}</div>
      </section>
    );
  }

  return (
    <section className={`${SECTION} flex flex-col gap-2.5 ${PAD}`}>
      {rows.map(({ date, digest }, at) => (
        <a
          className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper px-5 py-4"
          key={date}
          href={href(lang, dayPath(date))}
          /* `age` is the row's position IN THIS LIST, not the day's age in the
             archive: which day was opened is not the question — how far down
             readers actually reach is, and that is what says whether the rows
             below the fold are a product or a formality. */
          data-track="day_open"
          data-track-from={from}
          data-track-age={at}
        >
          <span className="flex items-center justify-between gap-3.5">
            <span className="text-lg font-bold text-ink">{date}</span>
            <span className="text-sm font-bold whitespace-nowrap text-ink-soft">
              {digest ? t.sectionCount(digest.stats.shown) : "—"}
            </span>
          </span>
          {digest?.articles[0] ? (
            <span className="line-clamp-1 text-sm text-ink-mid">
              {displayTitle(digest.articles[0], lang)}
            </span>
          ) : null}
        </a>
      ))}
    </section>
  );
}
