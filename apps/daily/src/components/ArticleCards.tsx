import { themedAccent } from "@/lib/accent";
import { accentColor, categoryName } from "@/lib/categories";
import { ArticleTitle } from "./ArticleTitle";
import { Cover } from "./Cover";
import { sourceOf } from "@/lib/sources";
import { href, type Lang } from "@/lib/lang";
import { articlePath, topicPath } from "@/lib/links";
import { summaryFor } from "@/lib/take";
import { topicLinkFor } from "@/lib/topics";
import type { PublishedArticle } from "@/lib/types";

/**
 * ONE HOVER SYSTEM, THREE SURFACES.
 *
 * Every action on the site is one of three shapes, so there are three strings and
 * not one per component — the alternative is what the site had, which is nothing
 * on the buttons and `hover:text-ink` scattered on a few links.
 *
 * NOTHING MOVES. The first version lifted the filled button a pixel and sank the
 * others on press; it is gone by decision. A control that shifts under a pointer
 * already on it makes the pointer wrong, and on a list of fifteen rows the effect
 * reads as the page twitching. Every state below is a change of COLOUR or
 * LIGHTNESS at a fixed position.
 *
 * THE CHANGE FITS THE SURFACE, which is why the three are not identical:
 *
 *   OUTLINE  the border and the text darken. These sit on the page's own ground
 *            and have somewhere to go — `border-line` to `border-ink-soft`,
 *            `text-ink-mid` to `text-ink`.
 *   FILLED   `bg-ink` cannot darken, so it goes the other way: `bg-ink-mid`, one
 *            step lighter. It stays plainly the primary action either way.
 *   TEXT     an orange link cannot darken without leaving the palette, so it
 *            dims. `opacity`, not a second colour token, because the accent has
 *            exactly one value in each theme by design.
 *
 * EVERY ONE HAS AN `active:` STATE, and that is the half that matters on a phone,
 * where there is no hover at all: a press is the only feedback a touch reader
 * ever gets, so each one pushes its own change a step further.
 *
 * 150ms — under the ~200ms where a transition starts being perceived as lag on a
 * control the pointer is already touching.
 *
 * `prefers-reduced-motion` is handled once, globally, in index.css. Nothing here
 * needs to repeat it.
 */
/* THE TWO STRINGS THAT USED TO BE HERE ARE GONE WITH THE ACTION ROW — there is
   no button or pill in this file any more (see the note where `Actions` was).
   The note above stays because two other files point at it: the article page and
   the front page each keep a local copy of the shape they use, and this is where
   the reasoning for all three lives. */

/** The dot between meta items. `bg-current` so it matches whatever colour the
 *  row is drawn in. */
function Dot() {
  return <span className="size-0.75 rounded-full bg-current opacity-55" />;
}

/**
 * The source, and the author when there is one.
 *
 * EXPORTED because the front page's lead uses it too. It was local while the
 * only thing that named an article was a list row; the teaser now carries the
 * same header block — cover, meta, headline — and two copies of a one-line
 * component are two places for the separator rules and the accent colour to
 * drift apart.
 */
/**
 * ASYNC, which is new and is the topic chip's doing: whether a topic has a page
 * is a question about the whole archive (see `topicLinkFor`), and it has to be
 * asked per card because a day holds articles from several topics.
 *
 * `ArticleBrief` below stays SYNCHRONOUS and renders `<Meta />` as an ordinary
 * element — a server component may await an async child without becoming async
 * itself, which is what keeps this from cascading up through `DigestView` into
 * the day page. Nothing here reads the filesystem a second time either: the
 * lookup is a map read over the index `archiveIndex` already caches.
 */
export async function Meta({
  article,
  lang,
  from,
}: {
  article: PublishedArticle;
  lang: Lang;
  /**
   * Which surface this row is on — `homepage` for the front page's teaser,
   * `archive` for a day's cards — and it is REQUIRED rather than defaulted.
   *
   * The two callers are different pages, and the whole value of `from` on a
   * topic event is telling them apart (see TRACKING.md). A default would have
   * been `archive`, which is right for the caller that has fifteen of these and
   * silently wrong for the one that has one — the kind of mislabelling that is
   * invisible until somebody reads a report and believes it.
   */
  from: string;
}) {
  const source = sourceOf(article.sourceId);
  const topic = await topicLinkFor(article);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-semibold text-ink-soft">
      {/**
       * THE TOPIC, FIRST IN THE ROW AND A LINK.
       *
       * The site showed a category NOWHERE for months — the tabs and the
       * section headings went with `DigestBody`, and the note that used to be
       * further down this file said so: "NO CATEGORY ANYWHERE… the registry
       * stays, because the publish floor lives in it". The registry is a set of
       * pages now, so the classification the summariser has been making all
       * along finally leads somewhere, and every card is where a reader meets
       * it.
       *
       * FIRST, AHEAD OF THE SOURCE, because the two answer different questions
       * and the topic is the one a reader scanning a mixed day is sorting by.
       * The source keeps its own colour and its position next to the author, so
       * nothing about the card's existing shape moves.
       *
       * ABSENT RATHER THAN PLAIN TEXT when the topic has no page — see
       * `topicLinkFor`. A chip that is grey and unclickable on some cards and
       * live on others is a control the reader has to test; one that is simply
       * not there on three cards out of a hundred is not noticed at all.
       */}
      {topic ? (
        <>
          <a
            className="flex items-center gap-1.5 transition duration-150 ease-out hover:text-ink"
            href={href(lang, topicPath(topic.id))}
            data-track="topic_open"
            data-track-topic={topic.id}
            data-track-from={from}
            data-track-lang={lang}
          >
            <span
              className="size-1.5 flex-none rounded-full"
              style={{ background: accentColor(topic) }}
            />
            {categoryName(topic, lang)}
          </a>
          <Dot />
        </>
      ) : null}
      <span style={{ color: themedAccent(source.accent) }}>{source.name}</span>
      {/* NO READING TIME. It was the original article's, which described a page
          the reader was not on; measured on the summary instead it read "1 分钟"
          or "2 分钟" on every card in the digest, which is a column of identical
          numbers rather than information. The masthead still totals the day — see
          `minutes` in DigestView — because a whole edition's length does vary.

          The author is now optional AND last, so the Dot lives inside the same
          condition: an anonymous source ends the row on the source name with no
          separator left dangling. */}
      {article.author ? (
        <>
          <Dot />
          <span>{article.author}</span>
        </>
      ) : null}
    </div>
  );
}


/**
 * THE ACTION ROW IS GONE FROM THE LIST — 「看总结」, 「看原文」 and the share
 * button were all here, and this note is what is left of them.
 *
 * WHY: a row in a list is NAVIGATION now. The whole row is a link to the
 * article page (see `ArticleBrief`), so the primary pill was a second control
 * pointing where the row already points, and the other two were asking a reader
 * to decide about a piece they have read three lines of. Both live on the
 * article page, one tap away, where the reader has actually read the take.
 *
 * WHAT IT COSTS, and it is not nothing:
 *
 *   `read_original` STOPS FIRING WITH `from=list`. That event is this digest's
 *   counter-metric and the list was one of its two surfaces. The union member
 *   stays (see lib/track) and the article page still sends it with
 *   `from=article`; what is gone is the ability to compare "left from the list"
 *   against "left after reading". If that comparison mattered, the pill has to
 *   come back rather than the number be reconstructed.
 *
 *   SHARING FROM THE LIST GOES TOO. The note that used to be here argued for it:
 *   the pill had been a link down to the article page's share block, "which
 *   meant a navigation between deciding to share and being able to". That
 *   argument was written when a row carried the WHOLE summary and a reader
 *   reached the share button having finished reading. A row carries a headline
 *   and a three-line dek now, so nobody is finishing anything here, and the
 *   navigation the pill was avoiding is the one the reader wants anyway.
 */

/**
 * ONE ROW OF THE DAY'S LIST: a number, the topic and source, the headline, the
 * dek, a thumbnail, and a chevron.
 *
 * IT WAS A CARD — `rounded-card bg-card p-4 shadow-soft`, with the cover on the
 * LEFT and three action pills along the bottom. A day of twelve of those is
 * twelve raised panels, each with its own shadow, padding and set of decisions,
 * on a page whose entire job is to be scanned. A weblog index is a column of
 * text with rules across it; the front page learned that already (see the
 * `divide-y` note in app/[lang]/page.tsx) and the day page was the last place
 * still stacking plates.
 *
 * THE THUMBNAIL MOVED TO THE RIGHT, which is the change that makes the rest of
 * it work. On the left it was a first-class element — the eye met a picture
 * before a word, on a page where the pictures are other people's article covers
 * and the words are ours. On the right it is what it actually is: an identifying
 * mark at the end of a row, and every headline in the list starts on one edge.
 *
 * THE NUMBER IS DELIBERATELY QUIET — `text-ink-soft` at the dek's size, not a
 * display figure. The list IS ranked (`shownArticles` returns the digest's own
 * order, which is by score), so a heavy `01` would read as a leaderboard and
 * invite an argument about why one piece beat another. What it is for is
 * orientation: how far down am I, and how much is left.
 */
export function ArticleBrief({
  article,
  date,
  lang,
  index,
}: {
  article: PublishedArticle;
  date: string;
  lang: Lang;
  /** 1-based position in the day's list, drawn as `01`. Passed in rather than
   *  derived, because the row does not know what it is a row of. */
  index: number;
}) {
  const thesis = summaryFor(article, lang).thesis;

  return (
    /**
     * `relative` carries the row's stretched link; `border-b` is the rule
     * between rows and `last:border-0` keeps the list's bottom edge clean, the
     * same arrangement `divide-y` gives the front page.
     *
     * THE WHOLE ROW TINTS ON HOVER, and it is the only feedback left. The
     * chevron moved and the headline changed colour; both are gone (see their
     * notes below), which would have left a row that is entirely clickable and
     * says so nowhere. A tint is the right weight for that: it marks the target
     * without claiming any one element inside it is the thing being pressed,
     * which is exactly true here — the stretched link IS the row.
     *
     * `-mx-4 px-4` (and the `sm:` pair) cancels the page gutter and re-applies
     * it inside, so the tint runs to the edge of the screen rather than stopping
     * 16px short and reading as a misaligned box. `PageShell` clips horizontal
     * overflow, so the negative margin cannot make the document scroll sideways.
     *
     * `bg-page-deep` is one step off the page's own ground — the same token the
     * cover placeholder sits on. `bg-card` was the other candidate and it is the
     * colour these rows used to BE, back when each was a raised plate; reusing
     * it would make a hover look like the old card coming back.
     */
    <div className="relative -mx-4 flex gap-3.5 border-b border-line px-4 py-5 transition duration-150 ease-out last:border-0 hover:bg-page-deep sm:-mx-7 sm:gap-4 sm:px-7">
      {/* The position. `w-6` is two tabular digits at this size, so every
          headline in the list starts on the same left edge whether the row is
          01 or 12. `tabular-nums` is what guarantees that. */}
      <span
        aria-hidden
        className="w-6 flex-none pt-0.5 text-[13px] leading-[1.65] font-bold tabular-nums text-ink-soft"
      >
        {String(index).padStart(2, "0")}
      </span>

      <div className="min-w-0 flex-1">
        {/* `relative z-10` because the stretch below is an `::after` on an
            element that comes LATER in the DOM, so without a stacking context
            here it would paint over the topic link inside `Meta`. */}
        <div className="relative z-10">
          <Meta article={article} lang={lang} from="archive" />
        </div>

        <h3 className="mt-1.5 text-lg leading-snug font-bold text-ink">
          {/* THE STRETCHED LINK — see the long note on this in the article
              page's own row. One real anchor whose text is the headline, with
              `::after` covering the row, rather than an invisible anchor over
              it: a link cannot legally contain the topic chip above. */}
          {/* NO `hover:` COLOUR ON THE HEADLINE. It turned orange, and the row
              is the target rather than the words — tinting the headline said
              "this text is the link", which is true of the markup and false of
              the interaction: the whole row responds. The row's own tint is
              where that is said now. */}
          <a
            className="after:absolute after:inset-0 after:z-0"
            href={href(lang, articlePath(date, article))}
            data-track="summary_open"
            data-track-source={article.sourceId}
            data-track-from="card"
          >
            <ArticleTitle article={article} lang={lang} variant="card" />
          </a>
        </h3>

        {/**
         * THE DEK — the thesis, and on a row that is the whole of what a list
         * owes a reader. No label: see `whyItMatters` in lib/i18n for the one
         * label that survived and why.
         *
         * 「为什么值得关注」 IS DELIBERATELY NOT HERE, and it was the single most
         * tempting thing to add — it is the better sentence, measured one
         * article at a time. On a list it is the wrong sentence twice over: it
         * assumes the reader already knows what happened, which on a row they
         * do not, and at ~91 characters against the thesis's ~47 it doubles the
         * height of a page whose whole job is to be scanned. See the note on
         * `leadOf`'s absence in lib/take.
         *
         * `line-clamp-3` is a ceiling, not a design: most theses run 35–65
         * characters and land inside three lines at this size anyway. It is here
         * so one long one cannot make its row twice the height of its
         * neighbours. Nothing is hidden from a crawler that was not already
         * there — the text is in the DOM either way.
         */}
        {thesis ? (
          <p className="mt-1.5 line-clamp-3 text-[15px] leading-[1.65] font-medium text-ink-mid">
            {thesis}
          </p>
        ) : null}
      </div>

      {/* The thumbnail. `flex-none` and outside the text column, so a long
          headline reflows without ever moving it. `self-start` rather than
          centred: with a three-line dek the row is taller than the image, and an
          image floating in the middle of that reads as unaligned rather than as
          centred.

          THE CHEVRON THAT SAT AFTER IT IS GONE. It was a `›` saying "there is
          more this way" at the end of every row — twelve of them down the page,
          all saying the same thing about a row that is entirely clickable
          anyway. What it was really doing was standing in for a hover state the
          row did not have; the row has one now. */}
      <Cover
        id={article.id}
        sourceId={article.sourceId}
        image={article.image}
        variant="card"
      />
    </div>
  );
}
