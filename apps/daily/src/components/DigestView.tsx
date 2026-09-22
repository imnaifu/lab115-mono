import { ArticleBrief } from "./ArticleCards";
import { PageShell } from "./PageShell";
import { EndLink, Footer, Masthead, PAD, SECTION } from "./Shell";
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
        /* THE DATE IS THE KICKER, THE COUNT IS THE HEADING, and they have just
           swapped places. An edition of a daily is its date, which was the whole
           argument for the date being the `<h1>` — and it held while this page
           was the only thing above the fold. There are three other destinations
           in the bar now, so a reader arriving here arrived asking "what is
           there today"; the count answers that, and the date says which today.
           The date keeps its weekday, which a kicker has room for. */
        kicker={formatDate(digest.date, lang)}
        title={t.dayHeading(shown.length)}
        /* THE VISIBLE TRAIL IS GONE from this page too — see the `← 返回` note
           on the article page for the argument. Here there was only one step
           above the date (首页), and the wordmark in the bar is that same link on
           every page. The day route's JSON-LD still declares its
           `BreadcrumbList`, which is the half a search result draws. */
        lead={t.dayLead}
      />

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
        /* NO `gap` ANY MORE. The rows carry their own `border-b` and sit flush
           against each other, which is what makes the list read as one column
           with rules across it rather than as a stack of separated objects —
           see the note on `ArticleBrief`. A gap here would put air on both sides
           of every rule and undo it. */
        <section className={`${SECTION} ${PAD}`}>
          {shown.map((article, at) => (
            <ArticleBrief
              article={article}
              date={digest.date}
              key={article.id}
              lang={lang}
              index={at + 1}
            />
          ))}
        </section>
      ) : (
        <EmptyState lang={lang} />
      )}

      {/**
       * THE DAY'S PHOTOGRAPH, AT THE FOOT OF THE LIST.
       *
       * IT HAS BEEN IN THREE PLACES AND THIS IS THE ARGUMENT FOR THE THIRD. It
       * opened this page as a 300px plate between the masthead and the list,
       * which pushed twelve headlines off the first screen of the one page whose
       * job is to be scanned. It became the front page's hero band, which was
       * right until the front page got a fixed masthead image of its own — a
       * publication's masthead should say what the publication is, not what today
       * is. Then it was nowhere, and "nowhere" is a feature deletion dressed up
       * as a layout decision.
       *
       * AFTER THE LIST it costs the scan nothing and keeps the thing that made it
       * worth having: it is the only image on this site that belongs to the DAY
       * rather than to somebody's article, and an edition closing on its own
       * picture is what a printed one does. A reader who has read the twelve
       * headlines has finished the page; this is what is under them.
       *
       * THE ATTRIBUTION COMES BACK WITH IT and is not optional. Wikimedia's
       * picture of the day is CC BY-SA more often than not and the credit is a
       * LICENCE OBLIGATION — see the note in components/Photo, which draws the
       * artist, the source and the licence and is why this is `PhotoCard` rather
       * than an `<img>`.
       *
       * Absent on every digest written before the field existed, and on any day
       * Wikimedia had nothing. Both render as no card at all rather than a gap.
       */}
      {digest.photo ? (
        <div className={`${SECTION} ${PAD}`}>
          <PhotoCard photo={digest.photo} lang={lang} />
        </div>
      ) : null}

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
