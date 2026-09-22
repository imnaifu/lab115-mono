import { accentColor, categoryName } from "@/lib/categories";
import { href, type Lang } from "@/lib/lang";
import { topicPath } from "@/lib/links";
import { liveTopics } from "@/lib/topics";

/**
 * The topics as a row of chips — peer navigation at the FOOT of a topic page.
 *
 * IT HAD TWO CALLERS AND A PROP FOR EACH DIFFERENCE. The front page carried a
 * copy of this row under its teaser, headed 「探索话题」, and that row is gone:
 * the bar names 话题 on `sm:` and up and the drawer names it on a phone, so a
 * third way to the same place, below the fold, was the site telling a reader
 * twice. What went with it was everything that existed only for that surface —
 * a `more` chip through to the hub (the bar goes there now) and a `scroll`
 * layout for a row that had to survive 393px above the day's first headline.
 * This row is at the foot of a page with nothing under it to push down, so it
 * wraps, which is what the front page could not do and the reason the prop was
 * there at all.
 *
 * IT NEVER BECOMES THE NAVIGATION. That was true when it had two callers and it
 * is what removing one of them was about.
 *
 * ONLY LIVE TOPICS, through `liveTopics`, which asks `hasTopicPage`: a chip is a
 * link, and a chip for a topic below the threshold is a link to a 404.
 */
export async function TopicChips({
  lang,
  from,
  exclude,
}: {
  lang: Lang;
  /** Which surface this row is on — the `from` on every chip's event. */
  from: string;
  /** A topic id to leave out: the one the reader is already on. A chip to the
   *  page you are looking at is a control that does nothing. */
  exclude?: string;
}) {
  const topics = (await liveTopics()).filter(
    ({ category }) => category.id !== exclude,
  );
  if (!topics.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map(({ category }) => (
        <a
          key={category.id}
          href={href(lang, topicPath(category.id))}
          className="flex flex-none items-center gap-2 rounded-button border border-line px-3.5 py-1.5 text-sm font-bold text-ink-mid transition duration-150 ease-out hover:border-ink-soft hover:text-ink active:opacity-80"
          /* Every topic event carries WHICH topic and WHICH language — see
             TRACKING.md. `from` is what separates the surfaces, and it stays a
             prop even with one caller: the event's shape is not something a
             later second caller should get to redefine. */
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
    </div>
  );
}
