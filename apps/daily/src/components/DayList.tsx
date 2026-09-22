import { displayTitle } from "./ArticleTitle";
import { PAD, SECTION } from "./Shell";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { readDigest, shownArticles } from "@/lib/store";

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
    dates.map(async (date) => {
      const digest = await readDigest(date);
      return {
        date,
        digest,
        // Resolved here, with the read, so the row below stays markup.
        top: digest ? shownArticles(digest)[0] : undefined,
      };
    }),
  );

  if (rows.length === 0) {
    return (
      <section className={`${SECTION} ${PAD}`}>
        <div className="rounded-card bg-page-deep px-5 py-4">{t.nothingYet}</div>
      </section>
    );
  }

  return (
    /* NO `gap`. The rows carry their own `border-b` and sit flush, which is what
       makes the list read as one column with rules across it rather than as a
       stack of separated objects — the same arrangement `ArticleBrief` uses, and
       a gap here would put air on both sides of every rule and undo it. */
    <section className={`${SECTION} ${PAD}`}>
      {rows.map(({ date, digest, top }, at) => {
        const [, month, day] = date.split("-").map(Number);
        return (
          <a
            /* FLAT ROWS, WHERE THESE WERE BORDERED PLATES. The whole site gave
               its cards up (see the note on `ArticleBrief`); this list was the
               last one still drawing them, which made the archive look like a
               page from a different version of the site. Same hover treatment
               too: the tint runs to the screen edge via the negative margin, so
               it does not stop 16px short and read as a misaligned box. */
            className="group relative -mx-4 flex items-baseline gap-4 border-b border-line px-4 py-4 transition duration-150 ease-out last:border-0 hover:bg-page-deep sm:-mx-7 sm:px-7"
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
            {/* THE DAY, NOT THE FULL DATE. The heading above this list already
                says which month and year, so a column of `2026-09-21` spends its
                width repeating it eleven times. `w-24` is the widest this label
                gets in either language, so every headline beside it starts on a
                common left edge. */}
            <span className="w-24 flex-none text-base font-bold text-ink">
              {t.monthDay(month, day)}
            </span>

            {/* The day's top PUBLISHED headline. `digest.articles[0]` would be
                the highest-scoring article whether or not it was published, and
                on a day where the top of the list was held back that is a
                headline the reader cannot open. */}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-mid">
              {top ? displayTitle(top, lang) : null}
            </span>

            <span className="flex-none text-sm font-bold whitespace-nowrap text-ink-soft">
              {digest ? t.sectionCount(digest.stats.shown) : "—"}
            </span>
          </a>
        );
      })}
    </section>
  );
}
