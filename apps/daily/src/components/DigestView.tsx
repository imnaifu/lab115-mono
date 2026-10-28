import { ArticleBrief } from "./ArticleCards";
import { PageShell } from "./PageShell";
import { Footer, HEADING, Masthead, PAD, SECTION } from "./Shell";
import { strings } from "@/lib/i18n";
import { PhotoCard } from "./Photo";
import { shownArticles } from "@/lib/store";
import type { Lang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { href } from "@/lib/lang";
import { sourceOf } from "@/lib/sources";
import { summaryFor } from "@/lib/take";
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
      <div className="rounded-panel border border-dashed border-line-strong px-7 py-14 text-center">
        {/* The design system's empty-state art: ink lines over a white and a
            yellow fill, in a well that stays light in dark mode so the ink
            still reads. */}
        <div className="mx-auto mb-5 flex size-22 items-center justify-center rounded-full bg-well">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            stroke="#2f3542"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden
          >
            <path
              d="M7 9.5A2.5 2.5 0 0 1 9.5 7H18v26H9.5A2.5 2.5 0 0 1 7 30.5v-21Z"
              fill="#ffffff"
            />
            <path
              d="M33 9.5A2.5 2.5 0 0 0 30.5 7H22v26h8.5a2.5 2.5 0 0 0 2.5-2.5v-21Z"
              fill="#f7c948"
            />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-extrabold text-ink">{t.emptyTitle}</h2>
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
  // The day's quotes, in the day's order. Only takes that carry one — the field
  // is optional, checked against the article before it is stored, and absent on
  // every archived day, which then renders no block at all.
  const quotes = shown.flatMap((article) => {
    const quote = summaryFor(article, lang).quote;
    return quote ? [{ article, quote }] : [];
  });

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
       * THE DAY'S PHOTOGRAPH, ABOVE THE LIST.
       *
       * IT HAS BEEN IN FOUR PLACES AND THE ARGUMENT AGAINST THIS ONE IS ON THE
       * RECORD, so it is worth stating plainly rather than quietly dropping: a
       * 300px plate here pushes most of twelve headlines off the first screen of
       * the page whose job is to be scanned. That is what moved it to the front
       * page's hero band, then to the foot of this list.
       *
       * IT IS HERE BY DECISION. An edition opens on its picture — that is what a
       * daily looks like, and the photograph is the only image on this site that
       * belongs to the DAY rather than to somebody's article. The scan costs a
       * scroll; the alternative cost the page its opening.
       *
       * THE CHEAPEST LEVER IF IT EVER NEEDS ONE is the plate's own ceiling,
       * `max-h-[300px]` in components/Photo, which was measured against a real
       * distribution of Wikimedia aspect ratios rather than picked. Lowering it
       * shortens the band without touching this decision.
       *
       * THE ATTRIBUTION IS NOT OPTIONAL wherever this sits. Wikimedia's picture
       * of the day is CC BY-SA more often than not and the credit is a LICENCE
       * OBLIGATION — which is why this is `PhotoCard` (it draws the artist, the
       * source and the licence) rather than an `<img>`.
       *
       * Absent on every digest written before the field existed, and on any day
       * Wikimedia had nothing. Both render as no card at all rather than a gap.
       */}
      {digest.photo ? (
        /* NO `SECTION` MARGIN. The masthead above already ends on its own `pb-4`,
           and `mt-8` on top of that put a hole between the day's heading and the
           day's picture — two things that belong to each other. The list below
           keeps its `mt-8`, so the photo sits with the masthead and the rows sit
           apart from both. */
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
        /* THE GAP IS BACK. The rows were flush, each with its own `border-b`,
           so the list read as one column with rules across it; they are flat
           cards now (see the note on `ArticleBrief`), and a card needs the air
           around it that a rule did not. */
        <section className={`${SECTION} ${PAD} flex flex-col gap-3`}>
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
       * 「言论」 — ONE SENTENCE FROM EACH OF THE DAY'S ARTICLES, in their own
       * words, under the list.
       *
       * A CHANGE OF RHYTHM, which is the whole job. The list above is ten rows of
       * the same shape; a weekly newsletter reads to the end because it breaks
       * into sections of different weights, and a run of short quotations is the
       * lightest one there is. It costs nothing to scan past and gives a reader
       * who stopped halfway a reason to scroll.
       *
       * The attribution links to OUR page for that article, not to the original:
       * the quote is a way back into the day, and the article page is where the
       * original link already lives.
       */}
      {quotes.length > 0 ? (
        <section className={`${SECTION} ${PAD}`}>
          <h2 className={`${HEADING} inline-block text-xl`}>{t.quotesHeading}</h2>
          {quotes.map(({ article, quote }) => (
            <figure
              key={article.id}
              className="border-b border-line py-5 last:border-0"
            >
              <blockquote className="text-[15px] leading-[1.75] font-normal text-ink">
                {lang === "zh" ? `「${quote}」` : `\u201c${quote}\u201d`}
              </blockquote>
              <figcaption className="mt-2 text-xs font-bold text-ink-soft">
                {"— "}
                <a
                  className="transition duration-150 ease-out hover:text-ink"
                  href={href(lang, articlePath(digest.date, article))}
                  data-track="summary_open"
                  data-track-source={article.sourceId}
                  data-track-from="quotes"
                >
                  {sourceOf(article.sourceId).name}
                  {" · "}
                  {(lang === "zh" ? article.titleZh : article.titleEn) ||
                    article.title}
                </a>
              </figcaption>
            </figure>
          ))}
        </section>
      ) : null}

      {/**
       * NO WAY-ONWARD CARD HERE ANY MORE. It read 「看其它日期 / 最近一周，以及
       * 更早的归档」 and pointed at `/`, and both halves of that had gone stale:
       * the front page is today's picks rather than a run of dates, and 归档 is
       * its own destination in the bar with a month browser behind it. A card
       * promising "the past week and the archive beyond it" led to neither.
       *
       * NOTHING REPLACES IT. The bar carries 今天 / 话题 / 归档 / 关于 on every
       * page and the phone gets the same four in the drawer, so the end of a
       * page no longer has to be a navigation surface — which is what let this
       * card exist in the first place, back when the footer was fine print and
       * the bar had one link in it.
       */}

      <Footer year={digest.date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
