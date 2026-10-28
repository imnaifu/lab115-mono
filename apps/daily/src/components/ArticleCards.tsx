import { themedAccent } from "@/lib/accent";
import { categoryName } from "@/lib/categories";
import { ArticleTitle } from "./ArticleTitle";
import { Cover } from "./Cover";
import { TopicIcon } from "./TopicIcon";
import { sourceOf } from "@/lib/sources";
import { href, type Lang } from "@/lib/lang";
import { strings } from "@/lib/i18n";
import { articlePath, topicPath } from "@/lib/links";
import { paragraphsOf } from "@/lib/paragraphs";
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
 *   OUTLINE  the secondary pill — a `border-line-strong` edge on paper — takes
 *            the sunk fill underneath it, `hover:bg-card`, the design system's
 *            secondary hover.
 *   FILLED   the yellow primary goes one step deeper, `bg-brand` to
 *            `bg-brand-deep`. It stays plainly the primary action either way.
 *   TEXT     a `text-link` link dims rather than changing colour. `opacity`,
 *            not a second colour token, because the link has exactly one value
 *            in each theme by design.
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
 * LOCAL AGAIN, AND IT WAS EXPORTED. The export existed for the front page's
 * teaser — "two copies of a one-line component are two places for the separator
 * rules and the accent colour to drift apart" — and that teaser is gone: the
 * front page draws the same `ArticleBrief` rows the day page does, so the only
 * caller is `ArticleBrief` below, in this file. An export nobody imports is a
 * claim that this shape is shared when it is not.
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
async function Meta({
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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-medium text-ink-soft">
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
      {/* A PILL WITH THE TOPIC'S ICON, the design system's tag, where it was
          a coloured dot and a word. It is a control — it goes to the topic's
          page — and in this system everything you press is round. No separator
          after it: the pill's own edge does that job. */}
      {topic ? (
        <a
          className="flex items-center gap-1 rounded-button bg-card px-2.5 py-0.5 font-medium text-ink transition duration-150 ease-out hover:bg-brand-soft active:bg-brand-soft"
          href={href(lang, topicPath(topic.id))}
          data-track="topic_open"
          data-track-topic={topic.id}
          data-track-from={from}
          data-track-lang={lang}
        >
          <TopicIcon id={topic.id} className="size-3.5" />
          {categoryName(topic, lang)}
        </a>
      ) : null}
      <span style={{ color: themedAccent(source.accent) }}>{source.name}</span>
      {/* NO READING TIME. It was the original article's, which described a page
          the reader was not on; measured on the summary instead it read "1 分钟"
          or "2 分钟" on every card in the digest, which is a column of identical
          numbers rather than information. (The masthead's day total went too —
          see the note in DigestView; only the mail still prints one.)

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
 * A CARD AGAIN, and a different one from the card it once was. That was
 * `rounded-card bg-card p-4 shadow-soft` — a raised plate on a cream page, with
 * the cover on the left and three action pills along the bottom, twelve
 * shadows and twelve sets of decisions on a page whose job is to be scanned;
 * the hairline rows that replaced it were right about that. The Sokosoko
 * restyle draws a list item as a FLAT white card on a hairline: no shadow at
 * rest, no actions inside, the same contents the rows had. On a white page the
 * hairline box is what separates one piece from the next, as the rule did.
 *
 * THE THUMBNAIL MOVED TO THE RIGHT, which is the change that makes the rest of
 * it work. On the left it was a first-class element — the eye met a picture
 * before a word, on a page where the pictures are other people's article covers
 * and the words are ours. On the right it is what it actually is: an identifying
 * mark at the end of a row, and every headline in the list starts on one edge.
 *
 * THE NUMBER IS A DISPLAY FIGURE NOW, Nunito at full weight, as the design
 * system draws a numbered list. It was deliberately quiet — `text-ink-soft` at
 * the dek's size — on the worry that a heavy `01` reads as a leaderboard, since
 * the list IS ranked (`shownArticles` returns the digest's own order, which is
 * by score). The worry is real and was traded for the look; what the number is
 * for is unchanged: how far down am I, and how much is left.
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
  const take = summaryFor(article, lang);
  const thesis = take.thesis;
  /**
   * A SHORT TAKE IS SHOWN WHOLE, in place of the dek — see `Article.form`.
   * It is 80–200 characters written to be read right here, the way an item in a
   * weekly newsletter is, so making the reader click through for it would put
   * the whole day behind ten taps. The dek is still on the article page above
   * the same text.
   *
   * Absent `form` is an archived day, whose takes are the long shape and stay
   * behind their dek exactly as before.
   */
  const brief = article.form === "short" ? paragraphsOf(take.text) : [];

  return (
    /**
     * `relative` carries the card's stretched link. The gap between cards is
     * the list's (`gap-3` on the caller), so a card owns none of the space
     * around it.
     *
     * THE WHOLE CARD LIFTS ON HOVER, and it is the only feedback there is. The
     * chevron moved and the headline changed colour; both are gone (see their
     * notes below), which would have left a card that is entirely clickable and
     * says so nowhere. A shadow arriving is the design system's hover for a
     * card: it marks the target without claiming any one element inside it is
     * the thing being pressed, which is exactly true here — the stretched link
     * IS the card.
     */
    <div className="relative flex gap-2.5 rounded-card border border-line bg-paper p-3.5 transition duration-150 ease-out hover:shadow-cover sm:gap-4 sm:p-5">
      {/* The position. `w-7` / `sm:w-10` is two tabular digits at each size,
          so every headline in the list starts on the same left edge whether
          the card is 01 or 12. `tabular-nums` is what guarantees that. */}
      <span
        aria-hidden
        className="w-7 flex-none font-display text-xl leading-none font-extrabold tabular-nums text-ink sm:w-10 sm:text-[32px]"
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

        {/* The one card that still needs a click to be read, so the one card
            that says so — as a yellow badge, the design system's mark for
            "this one is different". */}
        {article.form === "long" ? (
          <p className="mt-2">
            <span className="inline-flex rounded-button bg-brand px-2 py-0.5 text-[11px] leading-4 font-bold tracking-wider text-ink-fixed">
              {strings(lang).longRead}
            </span>
          </p>
        ) : null}

        <h3 className="mt-2 font-display text-lg leading-snug font-bold text-ink">
          {/* THE STRETCHED LINK — see the long note on this in the article
              page's own row. One real anchor whose text is the headline, with
              `::after` covering the row, rather than an invisible anchor over
              it: a link cannot legally contain the topic chip above. */}
          {/* NO `hover:` COLOUR ON THE HEADLINE. It turned orange once, and the
              card is the target rather than the words — tinting the headline
              said "this text is the link", which is true of the markup and
              false of the interaction: the whole card responds. The card's own
              lift is where that is said now. */}
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
         * 「为什么值得读」 IS DELIBERATELY NOT HERE, and it was the single most
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
        {brief.length ? (
          /* No `line-clamp`: the band in config.json is the ceiling here, and a
             clamped recommendation would cut off the reaction it ends on. */
          <div className="mt-1.5 space-y-2 text-[15px] leading-[1.65] font-normal text-ink-mid">
            {brief.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        ) : thesis ? (
          <p className="mt-1.5 line-clamp-3 text-[15px] leading-[1.65] font-normal text-ink-mid">
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
          row did not have; the card has one now. */}
      <Cover
        sourceId={article.sourceId}
        category={article.category}
        image={article.image}
        variant="card"
      />
    </div>
  );
}
