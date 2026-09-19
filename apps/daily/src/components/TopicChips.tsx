import { accentColor, categoryName } from "@/lib/categories";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { TOPIC_PATH, topicPath } from "@/lib/links";
import { liveTopics } from "@/lib/topics";

/**
 * The topics as a row of chips — the site's DISCOVERY LAYER, and deliberately a
 * thin one.
 *
 * TWO CALLERS, ONE DEFINITION. The front page puts it under the teaser as a way
 * in; a topic page puts it at the foot as peer navigation. They differ by three
 * things — whether the row scrolls or wraps, whether one topic is left out, and
 * whether it ends in a way through to the hub — and every one of those is a
 * prop rather than a second component, because what a chip looks like is the
 * part that must not drift. Two hand-rolled rows of pills diverge by a dot size
 * and a hover colour inside a couple of edits.
 *
 * IT NEVER BECOMES THE NAVIGATION. The bar carries ONE topic link (the hub) and
 * this row carries the eight; the row lives inside the page, below the thing
 * the page is actually for. On the front page in particular the date structure
 * stays the spine — a daily whose front page leads with a taxonomy has stopped
 * being a daily.
 *
 * ONLY LIVE TOPICS, through `liveTopics`, which asks `hasTopicPage`: a chip is a
 * link, and a chip for a topic below the threshold is a link to a 404.
 */
export async function TopicChips({
  lang,
  from,
  exclude,
  more = false,
  layout = "scroll",
}: {
  lang: Lang;
  /** Which surface this row is on — the `from` on every chip's event. */
  from: string;
  /** A topic id to leave out: the one the reader is already on. A chip to the
   *  page you are looking at is a control that does nothing. */
  exclude?: string;
  /** Whether the row ends in a way through to the hub. */
  more?: boolean;
  /**
   *   `scroll`  one line that scrolls sideways past the edge of the screen.
   *   `wrap`    as many lines as it takes.
   *
   * THE FRONT PAGE MUST SCROLL RATHER THAN WRAP. Eight chips plus the way
   * onward is about 640px of row; a 393px phone would take three lines of it,
   * and three lines of taxonomy above the day's first headline is the discovery
   * layer eating the page it is supposed to be a footnote on. Scrolling spends
   * one line at every width. On a topic page the row is at the FOOT, where
   * there is nothing underneath to push down, so it wraps and shows everything
   * at once.
   */
  layout?: "scroll" | "wrap";
}) {
  const t = strings(lang);
  const topics = (await liveTopics()).filter(
    ({ category }) => category.id !== exclude,
  );
  if (!topics.length) return null;

  const CHIP =
    "flex flex-none items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm font-bold text-ink-mid transition duration-150 ease-out hover:border-ink-soft hover:text-ink active:opacity-80";

  return (
    <div
      className={
        layout === "scroll"
          ? /**
             * ONE LINE, SCROLLED, AND IT BLEEDS INTO THE GUTTER.
             *
             * `-mx-4 px-4` (and the `sm:` pair) cancels the page's own padding
             * and re-applies it INSIDE the scroller, which is what makes the row
             * start flush with the text above it and still run all the way to
             * the screen edge when it overflows. Without it the last visible
             * chip stops 16px short and the row reads as clipped rather than as
             * scrollable.
             *
             * `[scrollbar-width:none]` and the WebKit pseudo-element hide the
             * bar: on a phone there is none to begin with, and on a trackpad
             * desktop a permanent grey bar under a row of pills is furniture.
             * Nothing is hidden BY it — the row fits uncut above ~700px, which
             * is under the 750px reading column, so a desktop reader never has
             * to scroll this at all.
             *
             * Snap points so a flick lands on a chip rather than half of one.
             */
            "-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden"
          : "flex flex-wrap gap-2"
      }
    >
      {topics.map(({ category }) => (
        <a
          key={category.id}
          href={href(lang, topicPath(category.id))}
          className={`${CHIP} snap-start`}
          /* Every topic event carries WHICH topic and WHICH language — see
             TRACKING.md. `from` is what separates the surfaces, and it is the
             caller's to name because the same row is on two of them. */
          data-track="topic_open"
          data-track-topic={category.id}
          data-track-from={from}
          data-track-lang={lang}
        >
          <span
            className="size-1.5 flex-none rounded-full"
            style={{ background: accentColor(category) }}
          />
          {categoryName(category, lang)}
        </a>
      ))}

      {/* The way through to the hub, LAST and looking like a chip rather than
          like a link: it is the ninth thing in a row of eight, and a reader
          scrolling to the end of the row should find it where the row ends.
          `topic_hub_open` is not a separate event — this opens `/topic`, which
          is a topic destination like any other, and `from` already says where
          it was pressed. `data-track-topic` is absent on purpose: there is no
          one topic behind it, and sending `all` would be a value the other
          chips never send. */}
      {more ? (
        <a
          href={href(lang, TOPIC_PATH)}
          className={`${CHIP} snap-start`}
          data-track="topic_open"
          data-track-from={from}
          data-track-lang={lang}
        >
          {t.topicMore}
          <span aria-hidden>→</span>
        </a>
      ) : null}
    </div>
  );
}
