import { ArticleBrief } from "./ArticleCards";
import { PageShell } from "./PageShell";
import {
  Breadcrumb,
  EndLink,
  Footer,
  Masthead,
  PAD,
  SECTION,
} from "./Shell";
import { strings } from "@/lib/i18n";
import { PhotoCard } from "./Photo";
import { shownArticles } from "@/lib/store";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import type { Digest } from "@/lib/types";

/** Rendered from the date key, not from a Date, so the server's timezone can
 *  never shift it by a day. */
function formatDate(date: string, lang: Lang): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return strings(lang).date(year, month, day, weekday);
}

export function EmptyState({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <section className={`${SECTION} ${PAD}`}>
      <div className="rounded-card bg-card px-7 py-14 text-center">
        <div className="mx-auto mb-5 flex size-22 items-center justify-center rounded-full bg-page">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M7 9.5A2.5 2.5 0 0 1 9.5 7H18v26H9.5A2.5 2.5 0 0 1 7 30.5v-21Z"
              fill="#3B3563"
              opacity="0.9"
            />
            <path
              d="M33 9.5A2.5 2.5 0 0 0 30.5 7H22v26h8.5a2.5 2.5 0 0 0 2.5-2.5v-21Z"
              fill="#EFA050"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-ink">{t.emptyTitle}</h2>
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-ink-mid">
          {t.emptyBody}
        </p>
      </div>
    </section>
  );
}

export function DigestView({
  digest,
  lang,
}: {
  digest: Digest;
  lang: Lang;
}) {
  const t = strings(lang);
  // `shownArticles` is what applies "no take means not published" — one read,
  // used by the count in the masthead and by the list below it.
  const shown = shownArticles(digest);

  /**
   * NO READING TIME IN THE MASTHEAD ANY MORE.
   *
   * It totalled the length of every summary on the page, and the summaries are
   * not on the page: this is a list of headlines and claims now, and each take
   * lives at its own URL. Leaving the number would repeat the exact mistake its
   * own note recorded getting fixed — it once summed the ORIGINAL articles'
   * lengths and "described a page the reader was not on". A count of pieces is
   * the honest thing a list can say about itself, and the row still says it.
   */

  return (
    /* `path` was a prop of this view, back when it also rendered the home page and
       the language switch had to land on whichever of the two you were actually
       on. The home page is a teaser for the newest day now — see
       app/[lang]/page.tsx — so this serves one URL and the path is this digest's. It goes to the shell
       rather than to the masthead because the switch moved into the site bar. */
    <PageShell lang={lang} path={dayPath(digest.date)}>
      <Masthead
        /* THE DAY IS THE HEADING. It was in the meta row, under a heading that
           read 每日严选 like every other page's; an edition of a daily is its
           date, so that is the `<h1>` and the row below keeps the two counts.

           `formatDate`, not the raw key: 「2026年8月27日 · 星期四」 is the day as
           a reader says it. The crumb keeps the key — see the note on it. */
        title={formatDate(digest.date, lang)}
        /* THE SAME TRAIL THE STRUCTURED DATA ALREADY DECLARED — see `breadcrumb`
           in the day route's JSON-LD, which has said 每日严选 › 2026-08-27 to
           crawlers for as long as it has existed while the page itself showed no
           trail at all.

           THE RAW DATE, not `formatDate`: the crumb is a compact trail, and that
           helper returns 「2026年8月27日 · 星期四」 — a middle dot inside a crumb
           reads as another separator. The formatted date with its weekday is in
           the meta row below, where it is the day's own line rather than a step
           in a path. */
        crumb={
          <Breadcrumb
            label={t.breadcrumb}
            items={[
              { label: t.home, href: href(lang, "/") },
              { label: digest.date },
            ]}
          />
        }
      >
        {/* `shown`, not `fetched`: the publish floor drops the rest, so
            fetched would promise cards that are not on the page. */}
        <span>{t.posts(digest.stats.shown)}</span>
      </Masthead>

      {/* Between the masthead and the list — it is the day's opening image, and
          below the first headline it would read as an entry rather than as the
          edition's picture. The front page shows this same photo above its
          teaser, for the same reason.

          No margin of its own — the masthead's `pb-8` is above it and the list's
          `mt-8` is below it. Absent on every digest written before photos
          existed, and on any day Wikimedia had nothing; both render as no card
          at all rather than as a gap. */}
      {digest.photo ? (
        <div className={PAD}>
          <PhotoCard photo={digest.photo} lang={lang} />
        </div>
      ) : null}


      {/**
       * ONE FLAT LIST, IN THE DAY'S OWN RANKING.
       *
       * The category tabs and the grouped sections are gone with `DigestBody`.
       * What they cost was the thing a daily is for: the running order. Sections
       * kept the registry's order rather than the day's, so the best piece of the
       * morning appeared wherever its category happened to fall, and a tab row
       * meant part of the edition was hidden behind a control by default.
       *
       * `shown` is already ranked — see `shownArticles` — so this is the order
       * the digest itself chose, top to bottom, with nothing to press first.
       */}
      {shown.length > 0 ? (
        <section className={`${SECTION} flex flex-col gap-3 ${PAD}`}>
          {shown.map((article) => (
            <ArticleBrief
              article={article}
              date={digest.date}
              key={article.id}
              lang={lang}
            />
          ))}
        </section>
      ) : (
        <EmptyState lang={lang} />
      )}

      <div className={PAD}>
        <EndLink
          /* THE FRONT PAGE, not `/archive`. The archive 404s until there are more
             days than the front page shows (see `hasArchive` in lib/paging), so
             linking straight to it from here would be a dead link for the site's
             first week and after any future change to that threshold. `/` is always
             a page, and it carries the route onward to the archive when there is
             one — day → front page → archive, with no condition to keep in sync. */
          href={href(lang, "/")}
          label={t.allDays}
          sub={t.allDaysSub}
          track="all_days_open"
        />
      </div>

      <Footer year={digest.date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
